import { GoogleGenAI } from "@google/genai";
import { safeExecute } from "../../../../db/config.js";
import { ServiceUnavailableError } from "../../../utils/errors/index.js";

const GEMINI_EMBEDDING_MODEL =
	process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const RECOMMEND_THRESHOLD = Number(process.env.RECOMMEND_THRESHOLD) || 0.75;
const RECOMMEND_K = Number(process.env.RECOMMEND_K) || 5;

if (!GEMINI_API_KEY) {
	throw new Error("GEMINI_API_KEY environment variable is required");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Collapse consecutive whitespace into a single space and trim ends.
 * @param {string} value
 * @returns {string}
 */
function normalizeWhitespace(value) {
	return value.replace(/\s+/g, " ").trim();
}

/**
 * Normalize question text to lowercase NFKC for consistent embedding input.
 * Combines title and optional content so the embedding captures full meaning.
 * @example ({ title: "Sort arrays?", content: "Using JS" }) → "sort arrays? using js"
 * @param {Object} params
 * @param {string} params.title
 * @param {string} [params.content]
 * @returns {string}
 */
export function normalizeQuestionText({ title, content }) {
	const titlePart = `${title || ""}`.normalize("NFKC").toLowerCase();
	const contentPart = `${content || ""}`.normalize("NFKC").toLowerCase();
	return normalizeWhitespace(contentPart ? `${titlePart} ${contentPart}` : titlePart);
}

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

/**
 * Cosine similarity between two equal-length vectors.
 * Formula: cos(θ) = (A · B) / (‖A‖ × ‖B‖)
 *
 * @param {number[]} vectorA
 * @param {number[]} vectorB
 * @returns {number} Score in [-1, 1] (typically [0, 1] for embeddings).
 * @throws {Error} If vectors differ in length.
 */
export function calculateCosineSimilarity(vectorA, vectorB) {
	if (vectorA.length !== vectorB.length) {
		throw new Error(
			`Vectors must have the same length. Got ${vectorA.length} and ${vectorB.length}.`,
		);
	}

	let dotProduct = 0;
	let magnitudeA = 0;
	let magnitudeB = 0;

	for (let i = 0; i < vectorA.length; i++) {
		dotProduct += vectorA[i] * vectorB[i];
		magnitudeA += vectorA[i] * vectorA[i];
		magnitudeB += vectorB[i] * vectorB[i];
	}

	magnitudeA = Math.sqrt(magnitudeA);
	magnitudeB = Math.sqrt(magnitudeB);

	if (magnitudeA === 0 || magnitudeB === 0) return 0;

	return dotProduct / (magnitudeA * magnitudeB);
}

// ---------------------------------------------------------------------------
// Gemini embedding
// ---------------------------------------------------------------------------

/**
 * Generate a vector embedding for `sourceText` using the Gemini API.
 *
 * @param {string} sourceText - Text to embed.
 * @param {Object} [options]
 * @param {string} [options.taskType='RETRIEVAL_DOCUMENT'] - Use 'RETRIEVAL_QUERY' for search queries.
 * @returns {Promise<{ embedding: number[] }>} 768-dimensional embedding vector.
 * @throws {Error} If the Gemini response is missing or invalid.
 */
export async function generateQuestionEmbedding(sourceText, options = {}) {
	const { taskType = "RETRIEVAL_DOCUMENT" } = options;

	try {
		const response = await ai.models.embedContent({
			model: GEMINI_EMBEDDING_MODEL,
			contents: sourceText,
			config: {
				taskType,
				outputDimensionality: 768,
			},
		});

		// Guard before accessing nested value — prevents TypeError on bad responses
		const values = response?.embeddings?.[0]?.values;

		if (!Array.isArray(values) || values.length === 0) {
			throw new Error("Gemini embedding response does not contain values.");
		}

		return { embedding: values };
	} catch (error) {
		console.error("[generateQuestionEmbedding error]:", error);
		console.error("***************************");
		throw error;
	}
}

// ---------------------------------------------------------------------------
// Embedding validation
// ---------------------------------------------------------------------------

/**
 * Assert that `embedding` is a non-empty array of finite numbers.
 * @param {unknown} embedding
 * @throws {Error}
 */
function validateEmbedding(embedding) {
	if (!Array.isArray(embedding)) {
		throw new Error("Embedding must be an array.");
	}
	if (embedding.length === 0) {
		throw new Error("Embedding cannot be empty.");
	}
	// FIX: was `.every(invalid)` — should throw when ANY value is invalid
	if (!embedding.every((v) => typeof v === "number" && !isNaN(v))) {
		throw new Error("Embedding must contain only valid numbers.");
	}
}

// ---------------------------------------------------------------------------
// Vector storage
// ---------------------------------------------------------------------------

/**
 * Upsert an embedding vector into `question_vectors`.
 * Passing an empty array or status='failed' stores a failed record.
 *
 * @param {Object} payload
 * @param {number|string} payload.questionId
 * @param {string}        payload.sourceText  - Normalized text used to generate the embedding.
 * @param {number[]}      [payload.embedding] - The 768-dim vector.
 * @param {string}        [payload.status]    - 'ready' | 'failed'. Defaults to 'ready'.
 * @returns {Promise<void>}
 */
export async function storeQuestionVector({
	questionId,
	sourceText,
	embedding = [],
	status = "ready",
}) {
	// Treat missing / empty embedding as a failure regardless of what status says
	const resolvedStatus =
		status === "failed" || !embedding || embedding.length === 0
			? "failed"
			: status;

	// Only validate when we actually expect a usable embedding
	if (resolvedStatus === "ready") {
		validateEmbedding(embedding);
	}

	const embeddingJson = JSON.stringify(resolvedStatus === "failed" ? [] : embedding);

	// Single SQL path — no duplication
	const sql = `
		INSERT INTO question_vectors (question_id, source_text, embedding, status)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			source_text   = VALUES(source_text),
			embedding     = VALUES(embedding),
			status        = VALUES(status),
			updated_at    = CURRENT_TIMESTAMP
	`;

	try {
		await safeExecute(sql, [questionId, sourceText, embeddingJson, resolvedStatus]);
	} catch (error) {
		console.error("=== MYSQL UPSERT ERROR ===");
		console.error("Operation: storeQuestionVector");
		console.error("Question ID:", questionId);
		console.error("Embedding length:", embedding.length);
		console.error("Status:", resolvedStatus);
		console.error("Error:", error);
		console.error("***************************");
		throw error;
	}
}

// ---------------------------------------------------------------------------
// Embedding retrieval
// ---------------------------------------------------------------------------

/**
 * Fetch all 'ready' embeddings ordered newest first (highest question_id first).
 * Invalid JSON rows are skipped with a warning.
 *
 * @returns {Promise<Array<{ questionId: number, embedding: number[] }>>}
 */
export async function retrieveReadyEmbeddings() {
	// ORDER BY question_id DESC → newest questions come first
	const sql = `
		SELECT question_id, embedding
		FROM question_vectors
		WHERE status = ?
		ORDER BY question_id DESC
	`;

	try {
		const rows = await safeExecute(sql, ["ready"]);

		const embeddings = [];
		for (const row of rows) {
			try {
				const embedding =
					typeof row.embedding === "string"
						? JSON.parse(row.embedding)
						: row.embedding;

				embeddings.push({ questionId: row.question_id, embedding });
			} catch (parseError) {
				console.warn(
					`Skipping question ${row.question_id}: failed to parse embedding JSON`,
					parseError,
				);
			}
		}

		return embeddings;
	} catch (error) {
		console.error("=== MYSQL RETRIEVE EMBEDDINGS ERROR ===");
		console.error("Operation: retrieveReadyEmbeddings");
		console.error("Error:", error);
		console.error("***************************");
		throw error;
	}
}

// ---------------------------------------------------------------------------
// Similarity search helpers (shared by both find* functions)
// ---------------------------------------------------------------------------

/**
 * Build a question-details map from a list of question IDs, ordered newest first.
 * Used by both findSimilarQuestionsByText and findSimilarQuestionsByQuestionId.
 *
 * @param {number[]} questionIds
 * @returns {Promise<Object>} Map of String(questionId) → question object
 */
async function fetchQuestionDetails(questionIds) {
	const placeholders = questionIds.map(() => "?").join(",");

	const sql = `
		SELECT
			q.question_id  AS questionId,
			q.question_hash AS questionHash,
			q.title,
			q.content,
			q.created_at   AS createdAt,
			q.updated_at   AS updatedAt,
			u.user_id      AS userId,
			u.first_name   AS firstName,
			u.last_name    AS lastName,
			COUNT(DISTINCT a.answer_id) AS answerCount
		FROM questions q
		JOIN  users   u ON u.user_id      = q.user_id
		LEFT JOIN answers a ON a.question_id = q.question_id
		WHERE q.question_id IN (${placeholders})
		GROUP BY q.question_id, u.user_id
		ORDER BY q.question_id DESC
	`;

	const rows = await safeExecute(sql, questionIds);

	const map = {};
	for (const row of rows) {
		map[String(row.questionId)] = {
			id: row.questionId,
			questionHash: row.questionHash,
			title: row.title,
			content: row.content,
			answerCount: row.answerCount,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			author: {
				id: row.userId,
				firstName: row.firstName,
				lastName: row.lastName,
			},
		};
	}
	return map;
}

// ---------------------------------------------------------------------------
// Public search functions
// ---------------------------------------------------------------------------

/**
 * Semantic search: embed `sourceText` as a query, score all stored vectors,
 * and return the top-k questions above `threshold`.
 *
 * @param {Object} params
 * @param {string} params.sourceText
 * @param {number} [params.threshold]
 * @param {number} [params.k]
 * @returns {Promise<{ embedding: number[], similarQuestions: Object[] }>}
 */
export async function findSimilarQuestionsByText({ sourceText, threshold, k }) {
	// FIX: use safe guards instead of ||, which would mishandle 0 values
	const normalizedK = k > 0 ? Math.min(k, 20) : RECOMMEND_K;
	const normalizedThreshold =
		threshold >= 0 && threshold <= 1 ? threshold : RECOMMEND_THRESHOLD;

	let embeddingResult;
	try {
		embeddingResult = await generateQuestionEmbedding(sourceText, {
			taskType: "RETRIEVAL_QUERY",
		});
	} catch (error) {
		console.error("=== GEMINI API ERROR DURING SEARCH ===");
		console.error("Operation: findSimilarQuestionsByText");
		console.error("Search text:", sourceText);
		console.error("Error:", error);
		console.error("***************************");
		throw new ServiceUnavailableError(
			"Failed to generate embedding for search query. Please try again later.",
		);
	}

	const queryEmbedding = embeddingResult.embedding;

	let storedEmbeddings;
	try {
		storedEmbeddings = await retrieveReadyEmbeddings();
	} catch (error) {
		console.error("=== DATABASE ERROR DURING SEARCH ===");
		console.error("Operation: findSimilarQuestionsByText");
		console.error("Search text:", sourceText);
		console.error("Error:", error);
		console.error("***************************");
		throw error;
	}

	// Score every stored embedding
	const similarities = [];
	for (const stored of storedEmbeddings) {
		try {
			const score = calculateCosineSimilarity(queryEmbedding, stored.embedding);
			if (score >= normalizedThreshold) {
				similarities.push({ questionId: stored.questionId, score });
			}
		} catch (err) {
			console.warn(
				`Skipping question ${stored.questionId} — similarity failed ` +
				`(query dim: ${queryEmbedding.length}, stored dim: ${stored.embedding?.length ?? "unknown"}): ` +
				err.message,
			);
		}
	}

	// Sort by score DESC, then by questionId DESC as tiebreaker (newest first)
	similarities.sort((a, b) => b.score - a.score || b.questionId - a.questionId);

	const topResults = similarities.slice(0, normalizedK);

	if (topResults.length === 0) {
		return { ...embeddingResult, similarQuestions: [] };
	}

	let questionMap;
	try {
		questionMap = await fetchQuestionDetails(topResults.map((r) => r.questionId));
	} catch (error) {
		console.error("=== DATABASE ERROR FETCHING QUESTION DETAILS ===");
		console.error("Operation: findSimilarQuestionsByText - fetch details");
		console.error("Question IDs:", topResults.map((r) => r.questionId));
		console.error("Error:", error);
		console.error("***************************");
		throw error;
	}

	// Rebuild in similarity-score order (preserving the sorted topResults order)
	const similarQuestions = topResults
		.filter((r) => questionMap[String(r.questionId)])
		.map((r) => ({
			score: Number(r.score.toFixed(6)),
			...questionMap[String(r.questionId)],
		}));

	return { ...embeddingResult, similarQuestions };
}

/**
 * Recommendation: find questions similar to an existing one using its stored embedding.
 * The source question itself is excluded from results.
 *
 * @param {Object} params
 * @param {number|string} params.questionId - Source question's ID.
 * @param {number} [params.threshold]
 * @param {number} [params.k]
 * @returns {Promise<Object[]>}
 */
export async function findSimilarQuestionsByQuestionId({
	questionId,
	threshold,
	k,
}) {
	const normalizedK = k > 0 ? Math.min(k, 20) : RECOMMEND_K;
	const normalizedThreshold =
		threshold >= 0 && threshold <= 1 ? threshold : RECOMMEND_THRESHOLD;

	// Fetch the source question's stored embedding
	let sourceEmbedding;
	try {
		const rows = await safeExecute(
			"SELECT embedding, status FROM question_vectors WHERE question_id = ?",
			[questionId],
		);

		if (rows.length === 0) return [];

		const row = rows[0];
		if (row.status !== "ready") return [];

		sourceEmbedding =
			typeof row.embedding === "string"
				? JSON.parse(row.embedding)
				: row.embedding;

		if (!Array.isArray(sourceEmbedding) || sourceEmbedding.length === 0) {
			console.warn(`Source question ${questionId} has invalid embedding format.`);
			return [];
		}

		// FIX: same inverted .every() bug — corrected to match validateEmbedding
		if (!sourceEmbedding.every((v) => typeof v === "number" && !isNaN(v))) {
			console.warn(`Source question ${questionId} has invalid embedding values.`);
			return [];
		}
	} catch (parseError) {
		console.warn(
			`Failed to parse embedding for question ${questionId}:`,
			parseError,
		);
		return [];
	}

	let storedEmbeddings;
	try {
		storedEmbeddings = await retrieveReadyEmbeddings();
	} catch (error) {
		console.error("=== DATABASE ERROR IN SIMILAR QUESTIONS SEARCH ===");
		console.error("Operation: findSimilarQuestionsByQuestionId - retrieve embeddings");
		console.error("Question ID:", questionId);
		console.error("Error:", error);
		console.error("***************************");
		throw error;
	}

	// Score all embeddings, excluding the source question
	const similarities = [];
	for (const stored of storedEmbeddings) {
		if (String(stored.questionId) === String(questionId)) continue;

		try {
			const score = calculateCosineSimilarity(sourceEmbedding, stored.embedding);
			if (score >= normalizedThreshold) {
				similarities.push({ questionId: stored.questionId, score });
			}
		} catch (err) {
			console.warn(
				`Skipping question ${stored.questionId} — similarity failed ` +
				`(source dim: ${sourceEmbedding.length}, stored dim: ${stored.embedding?.length ?? "unknown"}): ` +
				err.message,
			);
		}
	}

	// Sort by score DESC, newest first as tiebreaker
	similarities.sort((a, b) => b.score - a.score || b.questionId - a.questionId);

	const topResults = similarities.slice(0, normalizedK);

	if (topResults.length === 0) return [];

	let questionMap;
	try {
		questionMap = await fetchQuestionDetails(topResults.map((r) => r.questionId));
	} catch (error) {
		console.error("=== DATABASE ERROR FETCHING QUESTION DETAILS ===");
		console.error("Operation: findSimilarQuestionsByQuestionId - fetch details");
		console.error("Source Question ID:", questionId);
		console.error("Target Question IDs:", topResults.map((r) => r.questionId));
		console.error("Error:", error);
		console.error("***************************");
		throw error;
	}

	return topResults
		.filter((r) => questionMap[String(r.questionId)])
		.map((r) => ({
			score: Number(r.score.toFixed(6)),
			...questionMap[String(r.questionId)],
		}));
}

// ---------------------------------------------------------------------------
// Backfill
// ---------------------------------------------------------------------------

/**
 * Re-generate embeddings for every question that has no 'ready' vector.
 * Covers both questions with status='failed' and questions with no row at all.
 *
 * @returns {Promise<{ total: number, succeeded: number, failed: number }>}
 */
export async function reEmbedFailedQuestions() {
	const sql = `
		SELECT q.question_id, q.title, q.content
		FROM questions q
		LEFT JOIN question_vectors qv ON qv.question_id = q.question_id
		WHERE qv.question_id IS NULL OR qv.status != 'ready'
		ORDER BY q.question_id ASC
	`;

	const rows = await safeExecute(sql, []);
	const results = { total: rows.length, succeeded: 0, failed: 0 };

	for (const row of rows) {
		const sourceText = normalizeQuestionText({
			title: row.title,
			content: row.content,
		});

		try {
			const { embedding } = await generateQuestionEmbedding(sourceText);
			await storeQuestionVector({
				questionId: row.question_id,
				sourceText,
				embedding,
				status: "ready",
			});
			results.succeeded++;
		} catch (err) {
			console.error(`[reEmbedFailedQuestions] question ${row.question_id} failed:`, err.message);
			results.failed++;
		}
	}

	return results;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Expose the current vector search config (from env or defaults).
 * @returns {{ recommendThreshold: number, recommendK: number }}
 */
export function getVectorConfig() {
	return {
		recommendThreshold: RECOMMEND_THRESHOLD,
		recommendK: RECOMMEND_K,
	};
}
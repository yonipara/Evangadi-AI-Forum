import crypto from "crypto";
import { safeExecute } from "../../../../db/config.js";
import { BadRequestError, NotFoundError } from "../../../utils/errors/index.js";
import {
  findSimilarQuestionsByQuestionId,
  findSimilarQuestionsByText,
  generateQuestionEmbedding,
  getVectorConfig,
  normalizeQuestionText,
  reEmbedFailedQuestions,
  storeQuestionVector,
} from "./vector.service.js";

const generateQuestionHash = () => crypto.randomBytes(8).toString("hex");

/**
 * Creates a new question and stores its vector embedding for semantic search.
 * @param {Object} payload - The question data
 * @param {string} payload.userId - ID of the user creating the question
 * @param {string} payload.title - Title of the question
 * @param {string} payload.content - Content/body of the question
 * @returns {Promise<Object>} Object containing the created question
 */
export const createQuestionWithVectorService = async (payload) => {
  // Extract required fields from the payload
  const { userId, title, content } = payload;

  // Prepare the SQL statement for inserting a new question
  const insertQuestionSql =
    "INSERT INTO questions (question_hash, user_id, title, content) VALUES (?, ?, ?, ?)";

  // Generate a unique hash for the question
  const questionHash = generateQuestionHash();
  let questionResult;

  try {
    // Execute the insertion query safely
    questionResult = await safeExecute(insertQuestionSql, [
      questionHash,
      userId,
      title,
      content,
    ]);
  } catch (error) {
    // Handle specific foreign key constraint error for non-existent user
    if (error?.code === "ER_NO_REFERENCED_ROW_2") {
      throw new BadRequestError("User does not exist.");
    }
    // Re-throw any other unexpected errors
    throw error;
  }

  // Retrieve the auto-generated ID of the newly inserted question
  const questionId = questionResult.insertId;

  // Construct the result  object representing the created question
  const creationResult = {
    id: questionId,
    questionHash,
    title,
    content,
    userId,
  };

  // Normalize title + content together so the embedding captures full meaning
  const sourceText = normalizeQuestionText({
    title: payload.title,
    content: payload.content,
  });

  try {
    // Generate the vector embedding for the normalized question text
    // taskType defaults to RETRIEVAL_DOCUMENT — correct for storing indexed content
    const embeddingResult = await generateQuestionEmbedding(sourceText);

    // Store the generated vector embedding in the database with a 'ready' status
    await storeQuestionVector({
      questionId: creationResult.id,
      sourceText,
      embedding: embeddingResult.embedding,
      status: "ready",
    });
  } catch (error) {
    // Log detailed error information if vector generation or storage fails
    console.error("=== FAILED TO STORE VECTOR FOR QUESTION ===");
    console.error("Question ID:", creationResult.id);
    console.error("Operation: question creation");
    console.error("Error:", error);
    console.error("==========================================");

    // Explicitly record the failure state in the database so it can be retried or tracked later
    await storeQuestionVector({
      questionId: creationResult.id,
      sourceText,
      embedding: [],
      status: "failed",
    }).catch((e) => console.error("Failed to save failed status", e));
  }

  // Return the created question object
  return {
    question: creationResult,
  };
};

const buildQuestionFilters = (filters) => {
  const conditions = [];
  const params = [];

  if (filters.search) {
    conditions.push("(q.title LIKE ? OR q.content LIKE ?)");
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (filters.mine && filters.userId) {
    conditions.push("q.user_id = ?");
    params.push(filters.userId);
  }

  if (conditions.length === 0) {
    return { whereClause: "", params };
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
};

export const getQuestionsService = async (filters) => {
  const normalizedLimit = 100; // Fixed max 100 records
  const sortColumn = "q.created_at";
  const normalizedSortOrder = "DESC";

  const { whereClause, params } = buildQuestionFilters(filters);

  const listSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS userId,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u ON u.user_id = q.user_id
    LEFT JOIN answers a ON a.question_id = q.question_id
    ${whereClause}
    GROUP BY q.question_id, u.user_id
    ORDER BY ${sortColumn} ${normalizedSortOrder}
    LIMIT ${normalizedLimit}
  `;

  const rows = await safeExecute(listSql, params);

  return {
    data: rows.map((question) => ({
      id: question.id,
      questionHash: question.questionHash,
      title: question.title,
      content: question.content,
      answerCount: question.answerCount,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      author: {
        id: question.userId,
        firstName: question.firstName,
        lastName: question.lastName,
      },
    })),
    meta: {
      limit: normalizedLimit,
      total: rows.length,
      sortBy: "newest",
      sortOrder: normalizedSortOrder,
    },
  };
};

export const getSingleQuestionService = async ({
  questionHash,
  includeAnswers = true,
}) => {
  const normalizedAnswerLimit = 100; // Fixed max 100 records

  const questionSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS userId,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u ON u.user_id = q.user_id
    LEFT JOIN answers a ON a.question_id = q.question_id
    WHERE q.question_hash = ?
    GROUP BY q.question_id, u.user_id
  `;
  const questionRows = await safeExecute(questionSql, [questionHash]);

  if (questionRows.length === 0) {
    throw new NotFoundError("Question not found");
  }
  if (!includeAnswers) {
    return {
      question: questionRows[0],
    };
  }

  const questionId = questionRows[0].id;

  const answersSql = `
  SELECT
    a.answer_id AS id,
    a.content,
    a.created_at AS createdAt,
    a.updated_at AS updatedAt,
    au.user_id AS userId,
    au.first_name AS firstName,
    au.last_name AS lastName
  FROM answers a
  JOIN users au ON au.user_id = a.user_id
  WHERE a.question_id = ?
  ORDER BY a.created_at DESC
  LIMIT ${normalizedAnswerLimit}
`;
  const answers = await safeExecute(answersSql, [questionId]);

  return {
    question: {
      id: questionRows[0].id,
      questionHash: questionRows[0].questionHash,
      title: questionRows[0].title,
      content: questionRows[0].content,
      answerCount: questionRows[0].answerCount,
      createdAt: questionRows[0].createdAt,
      updatedAt: questionRows[0].updatedAt,
      author: {
        id: questionRows[0].userId,
        firstName: questionRows[0].firstName,
        lastName: questionRows[0].lastName,
      },
    },
    answers: answers.map((answer) => ({
      id: answer.id,
      content: answer.content,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
      author: {
        id: answer.userId,
        firstName: answer.firstName,
        lastName: answer.lastName,
      },
    })),
    answersMeta: {
      limit: normalizedAnswerLimit,
      total: answers.length,
    },
  };
};

/**
 * Performs semantic search on questions using vector similarity.
 * @param {Object} params - Search parameters
 * @param {string} params.query - The search query text
 * @param {number} [params.k=5] - Maximum number of similar questions to return
 * @param {number} [params.threshold] - Similarity threshold (uses config default if not provided)
 * @returns {Promise<Object>} Object containing similar questions and search metadata
 */
export const searchQuestionsSemanticService = async ({
  query,
  k = 5,
  threshold,
}) => {
  const sourceText = normalizeQuestionText({ title: query });
  const vectorConfig = getVectorConfig();
  const searchThreshold =
    threshold !== undefined ? threshold : vectorConfig.recommendThreshold;
  const result = await findSimilarQuestionsByText({
    sourceText,
    threshold: searchThreshold,
    k,
  });
  return {
    data: result.similarQuestions,
    meta: {
      query,
      k,
      threshold: searchThreshold,
      total: result.similarQuestions.length,
    },
  };
};

export const backfillFailedEmbeddingsService = async () => {
  return await reEmbedFailedQuestions();
};

export const getSimilarQuestionsService = async ({
  questionHash,
  k = 5,
  threshold,
}) => {
  const questionRows = await safeExecute(
    "SELECT question_id AS id FROM questions WHERE question_hash = ? LIMIT 1",
    [questionHash],
  );
  if (questionRows.length === 0) {
    throw new NotFoundError("Question not found");
  }
  const questionId = questionRows[0].id;
  const vectorConfig = getVectorConfig();
  const searchThreshold =
    threshold !== undefined ? threshold : vectorConfig.recommendThreshold;
  const similarQuestions = await findSimilarQuestionsByQuestionId({
    questionId,
    threshold: searchThreshold,
    k,
  });
  return {
    data: similarQuestions,
    meta: {
      questionHash,
      k,
      threshold: searchThreshold,
      total: similarQuestions.length,
    },
  };
};

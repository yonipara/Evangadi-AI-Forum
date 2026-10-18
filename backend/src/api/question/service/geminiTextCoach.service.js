import { GoogleGenAI } from "@google/genai";
// import { safeExecute } from "../../../../db/config.js";
import { ServiceUnavailableError } from "../../../utils/errors/index.js";

const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash-lite";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const RECOMMEND_THRESHOLD = Number(process.env.RECOMMEND_THRESHOLD) || 0.75;
const RECOMMEND_K = Number(process.env.RECOMMEND_K) || 5;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * Utility to collapse consecutive whitespace characters into a single space
 * and trim leading/trailing whitespace for consistent text formatting.
 * @param {string} value - The input text to normalize.
 * @returns {string} The normalized text with collapsed whitespace and trimmed ends.
 */
function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Strip optional markdown fence and parse JSON object from model text.
 * @param {string} raw
 * @returns {object|null}
 */
function parseJsonObjectFromGeminiText(raw) {
  if (!raw || typeof raw !== "string") return null;
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  try {
    const v = JSON.parse(t);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

async function fetchGeminiJsonTextResponse(userPrompt) {
  const response = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: userPrompt,
  });
  const text = response?.text;
  return typeof text === "string" ? text : "";
}

/**
 * Short coaching tips for a question draft (forum / coursework context).
 * @param {{ title: string, content: string }} param
 * @returns {Promise<{ tips: string[] }>}
 */
export const generateQuestionDraftCoachService = async ({ title, content }) => {
  const userPrompt = `You help learners write clearer technical forum posts.
QUESTION TITLE:
${title}

QUESTION BODY (markdown allowed):
${content}

Reply with ONLY valid JSON (no markdown fences), exactly this shape:
{"tips":["...", "..."]}

Rules:
- tips: array of 3 to 5 short strings (each under 120 characters).
- Focus on: missing context (error message, expected vs actual), reproducibility, a sharper title idea if needed, tone for peers.
- Do not claim the question is "correct" or grade homework; give constructive checklist-style tips only.`;

  try {
    const raw = await fetchGeminiJsonTextResponse(userPrompt);
    const parsed = parseJsonObjectFromGeminiText(raw);
    let tips = Array.isArray(parsed?.tips)
      ? parsed.tips
          .filter((t) => typeof t === "string" && t.trim())
          .map((t) => t.trim())
      : [];
    tips = tips.slice(0, 5);
    if (tips.length === 0) {
      tips = [
        "Add any error messages or exact behavior you see.",
        "Say what you already tried and what you expected instead.",
      ];
    }
    return { tips };
  } catch (error) {
    console.error("[DraftCoach] model:", GEMINI_TEXT_MODEL);
    console.error("[DraftCoach] error:", error?.message || error);
    throw new ServiceUnavailableError("Failed to generate draft coaching tips");
  }
};

/**
 * Assesses whether an answer draft addresses the question context.
 * @param {{ questionTitle: string, questionContent: string, answerText: string }} param
 * @returns {Promise<{ level: string, note: string }>}
 */
export const assessAnswerAgainstQuestionService = async ({
  questionTitle,
  questionContent,
  answerText,
}) => {
  const userPrompt = `You review whether a forum ANSWER draft addresses the QUESTION (relevance and completeness of engagement - not whether the answer is strictly correct).

QUESTION TITLE:
${questionTitle}

QUESTION BODY:
${questionContent}

ANSWER DRAFT:
${answerText}

Reply with ONLY valid JSON (no markdown fences), exactly this shape:
{
  "level":"strong"|"partial"|"weak",
  "note":"one short sentence"
}

Rules:
- level: "strong" if the draft clearly engages with the question; "partial" if somewhat related but missing key parts of the ask; "weak" if mostly off-topic or too vague.
- note: one sentence, plain language, no markdown, under 200 characters. Frame as fit/relevance, not grading.`;

  try {
    const raw = await fetchGeminiJsonTextResponse(userPrompt);
    const parsed = parseJsonObjectFromGeminiText(raw);
    const levelRaw = parsed?.level;
    const noteRaw = parsed?.note;

    const level =
      levelRaw === "strong" || levelRaw === "partial" || levelRaw === "weak"
        ? levelRaw
        : "partial";

    const note =
      typeof noteRaw === "string" && noteRaw.trim()
        ? noteRaw.trim().slice(0, 200)
        : "Ensure your answer directly addresses the specific context described in the question.";

    return { level, note };
  } catch (error) {
    throw new ServiceUnavailableError("Failed to assess answer relevance");
  }
};

import { apiClient } from '../core/api.client.js';

/**
 * Normalizes error messages from API responses.
 * @param {any} error
 * @returns {Error}
 */
function handleQuestionError(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return new Error('Request timed out. Please try again.');
    }
    return new Error(
      'Unable to connect to server. Please check your internet connection.',
    );
  }

  const backendMessage =
    error.response.data?.message ||
    error.response.data?.msg ||
    error.response.data?.error;

  return new Error(
    backendMessage || `Request failed with status ${error.response.status}`,
  );
}

/**
 * Fetches a list of questions with optional keyword or user filters.
 * @param {Object} [params]
 * @param {string} [params.search] - Keyword to search title/content
 * @param {boolean} [params.mine] - Whether to return only questions by current user
 * @returns {Promise<{ data: Array, meta: Object }>}
 */
export async function getQuestions({ search, mine } = {}) {
  try {
    const params = {};
    if (search && search.trim() !== '') {
      params.search = search.trim();
    }
    if (mine !== undefined) {
      params.mine = Boolean(mine);
    }

    const response = await apiClient.get('/api/questions', { params });
    const payload = response.data;

    // Handle defensive structures: payload.data (array) or payload.questions or payload
    const questions = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.questions)
      ? payload.questions
      : Array.isArray(payload)
      ? payload
      : [];

    return {
      data: questions,
      meta: payload?.meta || { total: questions.length },
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Performs semantic AI similarity search across questions.
 * @param {string} query - The search query (min 5 characters recommended)
 * @param {Object} [options]
 * @param {number} [options.k] - Max results to return
 * @param {number} [options.threshold] - Cosine similarity cutoff (0-1)
 * @returns {Promise<{ data: Array, meta: Object }>}
 */
export async function searchQuestionsSemantic(query, { k, threshold } = {}) {
  try {
    const params = { query: query?.trim() || '' };
    if (k !== undefined) params.k = k;
    if (threshold !== undefined) params.threshold = threshold;

    // Semantic search calls the Gemini API server-side before querying the DB,
    // so it can take longer than the default 10s timeout.
    const response = await apiClient.get('/api/questions/search', { params, timeout: 30000 });
    const payload = response.data;

    const results = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.results)
      ? payload.results
      : [];

    return {
      data: results,
      meta: payload?.meta || { total: results.length, query },
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Fetches a single question along with its answers using questionHash.
 * @param {string} questionHash - 16-character hex hash
 * @returns {Promise<{ question: Object, answers: Array, answersMeta?: Object }>}
 */
export async function getSingleQuestion(questionHash) {
  try {
    const response = await apiClient.get(`/api/questions/${questionHash}`);
    const payload = response.data;
    return {
      question: payload.question || payload.data,
      answers: payload.answers || [],
      answersMeta: payload.answersMeta || { total: payload.answers?.length || 0 },
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Posts a new question to the forum.
 * @param {Object} payload - { title, content }
 * @returns {Promise<Object>}
 */
export async function createQuestion({ title, content }) {
  try {
    const response = await apiClient.post('/api/questions', { title, content });
    return response.data;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Fetches questions semantically similar to the given question hash.
 * @param {string} questionHash
 * @param {Object} [options]
 * @param {number} [options.k]
 * @param {number} [options.threshold]
 * @returns {Promise<{ data: Array, meta: Object }>}
 */
export async function getSimilarQuestions(questionHash, { k, threshold } = {}) {
  try {
    const params = {};
    if (k !== undefined) params.k = k;
    if (threshold !== undefined) params.threshold = threshold;

    const response = await apiClient.get(
      `/api/questions/${questionHash}/similar`,
      { params, timeout: 30000 },
    );
    const payload = response.data;

    return {
      data: Array.isArray(payload?.data) ? payload.data : [],
      meta: payload?.meta || {},
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Requests AI Draft Coach feedback for a draft title and content.
 * @param {Object} payload - { title, content }
 * @returns {Promise<Object>}
 */
export async function generateQuestionDraftCoach({ title, content }) {
  try {
    const response = await apiClient.post('/api/questions/draft-coach', {
      title,
      content,
    });
    return response.data;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Requests AI Answer Fit assessment for an answer draft.
 * @param {string} questionHash
 * @param {string} answerText
 * @returns {Promise<Object>}
 */
export async function assessAnswerFit(questionHash, answerText) {
  try {
    const response = await apiClient.post(
      `/api/questions/${questionHash}/answer-fit`,
      { answerText },
    );
    return response.data;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

export const questionService = {
  getQuestions,
  searchQuestionsSemantic,
  getSingleQuestion,
  getSimilarQuestions,
  createQuestion,
  generateQuestionDraftCoach,
  assessAnswerFit,
};

export default questionService;

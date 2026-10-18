import { safeExecute } from '../../../../db/config.js';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../utils/errors/index.js';

const ANSWER_SELECT = `
  SELECT
    a.answer_id,
    a.question_id,
    a.user_id,
    a.content,
    a.created_at,
    a.updated_at,
    u.first_name,
    u.last_name
  FROM answers a
  INNER JOIN users u ON u.user_id = a.user_id
`;

/**
 * Maps a joined answers/users row to the API response shape.
 *
 * @param {Object} row - The database row.
 * @param {number} row.answer_id - The answer ID.
 * @param {number} row.question_id - The parent question ID.
 * @param {number} row.user_id - The author's user ID.
 * @param {string} row.content - The answer text.
 * @param {Date} row.created_at - When the answer was created.
 * @param {Date} row.updated_at - When the answer was last updated.
 * @param {string} row.first_name - The author's first name.
 * @param {string} row.last_name - The author's last name.
 * @returns {Object} The mapped answer, including author details.
 */
const mapAnswer = row => ({
  id: row.answer_id,
  questionId: row.question_id,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: {
    id: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
  },
});

/**
 * Finds a question by ID.
 *
 * @param {number} questionId - The question ID to look up.
 * @returns {Promise<Object|null>} The question row, or null if it does not exist.
 */
const getQuestionById = async questionId => {
  const rows = await safeExecute(
    'SELECT question_id FROM questions WHERE question_id = ? LIMIT 1',
    [questionId],
  );
  return rows[0] || null;
};

/**
 * Finds an answer row by ID, joined with the author's name.
 *
 * @param {number} answerId - The answer ID to look up.
 * @returns {Promise<Object|null>} The joined answer row, or null if it does not exist.
 */
const getAnswerRowById = async answerId => {
  const rows = await safeExecute(
    `${ANSWER_SELECT} WHERE a.answer_id = ? LIMIT 1`,
    [answerId],
  );
  return rows[0] || null;
};

/**
 * Ensures the current user owns the answer.
 *
 * @param {Object} answerRow - The answer row from the database.
 * @param {number} answerRow.user_id - The answer author's user ID.
 * @param {number} userId - The authenticated user's ID.
 * @returns {void}
 * @throws {ForbiddenError} If the user does not own the answer.
 */
const assertAnswerOwner = (answerRow, userId) => {
  if (answerRow.user_id !== userId) {
    throw new ForbiddenError('You can only modify your own answers.');
  }
};

/**
 * Creates an answer for an existing question.
 *
 * @param {Object} payload - The answer data.
 * @param {number} payload.questionId - The parent question ID.
 * @param {number} payload.userId - The authenticated author's user ID.
 * @param {string} payload.content - The answer text.
 * @returns {Promise<Object>} The created answer object.
 * @throws {NotFoundError} If the question does not exist.
 */
export const createAnswerService = async ({ questionId, userId, content }) => {
  const question = await getQuestionById(questionId);
  if (!question) {
    throw new NotFoundError('Question not found.');
  }

  const result = await safeExecute(
    'INSERT INTO answers (question_id, user_id, content) VALUES (?, ?, ?)',
    [questionId, userId, content],
  );

  const created = await getAnswerRowById(result.insertId);
  return mapAnswer(created);
};

/**
 * Lists answers for a question, oldest first.
 *
 * @param {number} questionId - The parent question ID.
 * @returns {Promise<Object[]>} The answers for that question.
 * @throws {NotFoundError} If the question does not exist.
 */
export const listAnswersByQuestionService = async questionId => {
  const question = await getQuestionById(questionId);
  if (!question) {
    throw new NotFoundError('Question not found.');
  }

  const rows = await safeExecute(
    `${ANSWER_SELECT} WHERE a.question_id = ? ORDER BY a.created_at ASC`,
    [questionId],
  );

  return rows.map(mapAnswer);
};

/**
 * Returns a single answer by ID.
 *
 * @param {number} answerId - The answer ID to look up.
 * @returns {Promise<Object>} The mapped answer object.
 * @throws {NotFoundError} If the answer does not exist.
 */
export const getAnswerByIdService = async answerId => {
  const answer = await getAnswerRowById(answerId);
  if (!answer) {
    throw new NotFoundError('Answer not found.');
  }

  return mapAnswer(answer);
};

/**
 * Updates an answer owned by the current user.
 *
 * @param {Object} payload - The update data.
 * @param {number} payload.answerId - The answer ID to update.
 * @param {number} payload.userId - The authenticated user's ID.
 * @param {string} payload.content - The updated answer text.
 * @returns {Promise<Object>} The updated answer object.
 * @throws {NotFoundError} If the answer does not exist.
 * @throws {ForbiddenError} If the user does not own the answer.
 */
export const updateAnswerService = async ({ answerId, userId, content }) => {
  const answer = await getAnswerRowById(answerId);
  if (!answer) {
    throw new NotFoundError('Answer not found.');
  }

  assertAnswerOwner(answer, userId);

  await safeExecute('UPDATE answers SET content = ? WHERE answer_id = ?', [
    content,
    answerId,
  ]);

  const updated = await getAnswerRowById(answerId);
  return mapAnswer(updated);
};

/**
 * Deletes an answer owned by the current user.
 *
 * @param {Object} payload - The delete data.
 * @param {number} payload.answerId - The answer ID to delete.
 * @param {number} payload.userId - The authenticated user's ID.
 * @returns {Promise<void>}
 * @throws {NotFoundError} If the answer does not exist.
 * @throws {ForbiddenError} If the user does not own the answer.
 */
export const deleteAnswerService = async ({ answerId, userId }) => {
  const answer = await getAnswerRowById(answerId);
  if (!answer) {
    throw new NotFoundError('Answer not found.');
  }

  assertAnswerOwner(answer, userId);

  await safeExecute('DELETE FROM answers WHERE answer_id = ?', [answerId]);
};

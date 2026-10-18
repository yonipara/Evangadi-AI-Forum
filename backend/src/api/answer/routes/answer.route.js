import express from 'express';
import { authenticateUser } from '../../../middleware/authentication.js';
import {
  createAnswerController,
  deleteAnswerController,
  getAnswerController,
  listAnswersController,
  updateAnswerController,
} from '../controller/answer.controller.js';
import {
  answerIdParamValidation,
  createAnswerValidation,
  listAnswersValidation,
  updateAnswerValidation,
} from '../validations/answer.validation.js';

const router = express.Router();

/**
 * Requires a valid JWT on every answer route.
 */
router.use(authenticateUser);

/**
 * Posts a new answer for an existing question.
 *
 * @route POST /api/answers
 * @access Private
 * @param {number} req.body.questionId - The parent question ID.
 * @param {string} req.body.content - The answer text.
 */
router.post('/', createAnswerValidation, createAnswerController);

/**
 * Lists answers for a question, oldest first.
 *
 * @route GET /api/answers?questionId=1
 * @access Private
 * @param {number} req.query.questionId - The parent question ID.
 */
router.get('/', listAnswersValidation, listAnswersController);

/**
 * Returns a single answer by ID.
 *
 * @route GET /api/answers/:answerId
 * @access Private
 * @param {number} req.params.answerId - The answer ID from the route.
 */
router.get('/:answerId', answerIdParamValidation, getAnswerController);

/**
 * Updates an answer owned by the current user.
 *
 * @route PUT /api/answers/:answerId
 * @access Private
 * @param {number} req.params.answerId - The answer ID from the route.
 * @param {string} req.body.content - The updated answer text.
 */
router.put('/:answerId', updateAnswerValidation, updateAnswerController);

/**
 * Deletes an answer owned by the current user.
 *
 * @route DELETE /api/answers/:answerId
 * @access Private
 * @param {number} req.params.answerId - The answer ID from the route.
 */
router.delete('/:answerId', answerIdParamValidation, deleteAnswerController);

export default router;

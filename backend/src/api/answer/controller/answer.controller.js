import { StatusCodes } from 'http-status-codes';
import {
  createAnswerService,
  deleteAnswerService,
  getAnswerByIdService,
  listAnswersByQuestionService,
  updateAnswerService,
} from '../service/answer.service.js';

/**
 * Posts a new answer for an existing question.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {number} req.body.questionId - The parent question ID.
 * @param {string} req.body.content - The answer text.
 * @param {number} req.user.id - The authenticated user's ID.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
export const createAnswerController = async (req, res, next) => {
  try {
    const { questionId, content } = req.body;

    const answer = await createAnswerService({
      questionId,
      userId: req.user.id,
      content,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Answer posted successfully.',
      answer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists answers for a question, oldest first.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {number} req.query.questionId - The parent question ID.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
export const listAnswersController = async (req, res, next) => {
  try {
    const { questionId } = req.query;
    const answers = await listAnswersByQuestionService(questionId);

    res.status(StatusCodes.OK).json({
      success: true,
      answers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns a single answer by ID.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {number} req.params.answerId - The answer ID from the route.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
export const getAnswerController = async (req, res, next) => {
  try {
    const { answerId } = req.params;
    const answer = await getAnswerByIdService(answerId);

    res.status(StatusCodes.OK).json({
      success: true,
      answer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an answer owned by the current user.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {number} req.params.answerId - The answer ID from the route.
 * @param {string} req.body.content - The updated answer text.
 * @param {number} req.user.id - The authenticated user's ID.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
export const updateAnswerController = async (req, res, next) => {
  try {
    const { answerId } = req.params;
    const { content } = req.body;

    const answer = await updateAnswerService({
      answerId,
      userId: req.user.id,
      content,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Answer updated successfully.',
      answer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes an answer owned by the current user.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {number} req.params.answerId - The answer ID from the route.
 * @param {number} req.user.id - The authenticated user's ID.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
export const deleteAnswerController = async (req, res, next) => {
  try {
    const { answerId } = req.params;

    await deleteAnswerService({
      answerId,
      userId: req.user.id,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Answer deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

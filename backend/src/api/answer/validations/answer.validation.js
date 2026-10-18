import { body, param, query } from 'express-validator';
import { validationErrorHandler } from '../../../middleware/validation-handler.js';

/**
 * Validates the request body when posting a new answer.
 *
 * @param {number} questionId - The parent question ID from the request body.
 * @param {string} content - The answer text from the request body (min 3 characters).
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const createAnswerValidation = [
  body('questionId')
    .notEmpty()
    .withMessage('Question ID is required')
    .isInt({ min: 1 }) 
    .withMessage('Question ID must be a positive integer')
    .toInt(),
  body('content')
    .notEmpty()
    .withMessage('Answer content is required')
    .isString()
    .withMessage('Answer content must be a string')
    .isLength({ min: 3 })
    .withMessage('Answer content must be at least 3 characters long')
    .trim(),
  validationErrorHandler,
];

/**
 * Validates the URL param and body when updating an answer.
 *
 * @param {number} answerId - The answer ID from the route param.
  * @param {string} content - The updated answer text from the request body (min 3 characters).
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const updateAnswerValidation = [
  param('answerId')
    .isInt({ min: 1 })
    .withMessage('Answer ID must be a positive integer')
    .toInt(),
  body('content')
    .notEmpty()
    .withMessage('Answer content is required')
    .isString()
    .withMessage('Answer content must be a string')
    .isLength({ min: 3 })
    .withMessage('Answer content must be at least 3 characters long')
    .trim(),
  validationErrorHandler,
];

/**
 * Validates the answer ID in the route param (URL param).
 *
 * @param {number} answerId - The answer ID from the route param.
 * @returns {Array} Middleware that rejects an invalid ID with 400.
 */
export const answerIdParamValidation = [
  param('answerId')
    .isInt({ min: 1 })
    .withMessage('Answer ID must be a positive integer')
    .toInt(),
  validationErrorHandler,
];

/**
 * Validates the query string when listing answers for a question.
 *
 * @param {number} questionId - The parent question ID from the query string.
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const listAnswersValidation = [
  query('questionId')
    .notEmpty()
    .withMessage('Question ID is required')
    .isInt({ min: 1 })
    .withMessage('Question ID must be a positive integer')
    .toInt(),
  validationErrorHandler,
];

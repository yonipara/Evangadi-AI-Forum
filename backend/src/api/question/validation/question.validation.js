import { body, param, query } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

export const createQuestionValidation = [
  body("title")
    .notEmpty()
    .withMessage("Question title is required")
    .isString()
    .withMessage("Question title must be a string")
    .isLength({ min: 5, max: 255 })
    .withMessage("Question title must be between 5 and 255 characters")
    .trim(),
  body("content")
    .notEmpty()
    .withMessage("Question content is required")
    .isString()
    .withMessage("Question content must be a string")
    .isLength({ min: 10 })
    .withMessage("Question content must be at least 10 characters")
    .trim(),
  validationErrorHandler,
];

export const getQuestionsValidation = [
  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim(),
  query("mine")
    .optional()
    .isBoolean()
    .withMessage("Mine must be a boolean")
    .toBoolean(),
  validationErrorHandler,
];

export const getSingleQuestionValidation = [
  param("questionHash")
    .isString()
    .withMessage("Question hash is required and must be a string")
    .matches(/^[a-f0-9]{16}$/)
    .withMessage(
      "Question hash must be a 16-character lowercase hexadecimal string",
    ),
  validationErrorHandler,
];

export const searchQuestionsSemanticValidation = [
  query("query")
    .notEmpty()
    .withMessage("Query parameter is required for semantic search")
    .isString()
    .withMessage("Query parameter must be a string")
    .isLength({ min: 5 })
    .withMessage("Query parameter must be at least 5 characters long")
    .trim(),
  query("k")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("k must be an integer between 1 and 20")
    .toInt(),
  query("threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("threshold must be a float between 0 and 1")
    .toFloat(),
  validationErrorHandler,
];

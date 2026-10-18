import { param, query, body } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

export const documentIdParamValidation = [
  param("documentId")
    .isInt({ min: 1 })
    .withMessage("Document ID must be a positive integer")
    .toInt(),
  validationErrorHandler,
];

export const searchDocumentValidation = [
  param("documentId")
    .isInt({ min: 1 })
    .withMessage("Document ID must be a positive integer")
    .toInt(),
  query("query")
    .notEmpty()
    .withMessage("Query is required")
    .isString()
    .withMessage("Query must be a string")
    .trim(),
  query("k")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("k must be an integer between 1 and 20")
    .toInt(),
  validationErrorHandler,
];

export const queryDocumentValidation = [
  param("documentId")
    .isInt({ min: 1 })
    .withMessage("Document ID must be a positive integer")
    .toInt(),
  body("query")
    .notEmpty()
    .withMessage("Query is required")
    .isString()
    .withMessage("Query must be a string")
    .trim(),
  validationErrorHandler,
];

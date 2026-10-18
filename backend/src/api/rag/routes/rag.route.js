import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  createDocumentController,
  listDocumentsController,
  getDocumentMetaController,
  getDocumentFileController,
  deleteDocumentController,
  searchInDocumentController,
  queryDocumentController,
} from "../controller/rag.controller.js";
import {
  documentIdParamValidation,
  searchDocumentValidation,
  queryDocumentValidation,
} from "../validation/rag.validation.js";
import {
  upload,
  createDocumentMulterErrorHandler,
} from "../rag.upload.config.js";
const router = express.Router();
router.use(authenticateUser);
// POST /api/rag/documents
router.post(
  "/",
  upload.single("file"),
  createDocumentMulterErrorHandler,
  createDocumentController,
);
// GET /api/rag/documents
router.get("/", listDocumentsController);
// GET /api/rag/documents/:documentId/file — must come before /:documentId to avoid ambiguity
router.get(
  "/:documentId/file",
  documentIdParamValidation,
  getDocumentFileController,
);
// GET /api/rag/documents/:documentId/search
router.get(
  "/:documentId/search",
  searchDocumentValidation,
  searchInDocumentController,
);
// POST /api/rag/documents/:documentId/query
router.post(
  "/:documentId/query",
  queryDocumentValidation,
  queryDocumentController,
);
// GET /api/rag/documents/:documentId
router.get(
  "/:documentId",
  documentIdParamValidation,
  getDocumentMetaController,
);
// DELETE /api/rag/documents/:documentId
router.delete(
  "/:documentId",
  documentIdParamValidation,
  deleteDocumentController,
);
export default router;
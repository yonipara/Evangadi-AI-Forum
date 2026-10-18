import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  backfillEmbeddingsController,
  createQuestionController,
  getQuestionsController,
  getSingleQuestionController,
  searchQuestionsSemanticController,
  getSimilarQuestionsController,
  generateQuestionDraftCoachController,
  assessAnswerAgainstQuestionController,
} from "../controller/question.controller.js";
import {
  createQuestionValidation,
  getQuestionsValidation,
  getSingleQuestionValidation,
  searchQuestionsSemanticValidation,
} from "../validation/question.validation.js";

const router = express.Router();

router.use(authenticateUser);

// POST /api/questions
router.post("/", createQuestionValidation, createQuestionController);

// GET /api/questions
router.get("/", getQuestionsValidation, getQuestionsController);

// GET /api/questions/search?query=...
// Defined before /:questionHash so "search" is not captured as a hash param
router.get(
  "/search",
  searchQuestionsSemanticValidation,
  searchQuestionsSemanticController,
);

// POST /api/questions/draft-coach
// Defined before /:questionHash so "draft-coach" is not captured as a hash param
router.post("/draft-coach", generateQuestionDraftCoachController);

// POST /api/questions/backfill-embeddings
// Re-embeds any question with status='failed' or no vector row.
// Call once after fixing a Gemini API key or model issue.
router.post("/backfill-embeddings", backfillEmbeddingsController);

// GET /api/questions/:questionHash
router.get(
  "/:questionHash",
  getSingleQuestionValidation,
  getSingleQuestionController,
);

// GET /api/questions/:questionHash/similar
router.get(
  "/:questionHash/similar",
  getSingleQuestionValidation,
  getSimilarQuestionsController,
);

// POST /api/questions/:questionHash/answer-fit
router.post(
  "/:questionHash/answer-fit",
  getSingleQuestionValidation,
  assessAnswerAgainstQuestionController,
);

export default router;

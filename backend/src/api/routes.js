import express from "express";
import authRoutes from "./auth/routes/auth.routes.js";
import answerRoutes from "./answer/routes/answer.route.js";
import questionRoutes from "./question/routes/question.route.js";
import ragRoutes from "./rag/routes/rag.route.js";

export const mainRouter = express.Router();

// Authentication routes
mainRouter.use("/auth", authRoutes);

// Answer routes
mainRouter.use("/answers", answerRoutes);

// Question routes
mainRouter.use("/questions", questionRoutes);

// RAG document routes
mainRouter.use("/rag/documents", ragRoutes);
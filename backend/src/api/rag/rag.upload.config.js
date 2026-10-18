import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // get the directory of the current file.

export const UPLOADS_BASE = path.join(__dirname, "..", "..", "..", "uploads"); // Build the absolute path to the uploads folder

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed."), false);
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

export const createDocumentMulterErrorHandler = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({
          success: false,
          message: "File too large. Maximum size is 10MB.",
        });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err?.message === "Only PDF files are allowed.") {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
};

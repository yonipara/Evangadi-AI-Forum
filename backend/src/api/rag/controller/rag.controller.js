import path from 'path';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError } from '../../../utils/errors/index.js';
import { UPLOADS_BASE } from '../rag.upload.config.js';
import {
  createDocumentFromUploadService,
  listDocumentsForUserService,
  getDocumentMetaService,
  deleteDocumentService,
  searchInDocumentService,
  queryDocumentService,
} from '../service/rag.service.js';

export const createDocumentController = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new BadRequestError('A PDF file is required.');
    }

    const data = await createDocumentFromUploadService({
      file: req.file,
      userId: req.user.id,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Document uploaded and processed.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const listDocumentsController = async (req, res, next) => {
  try {
    const data = await listDocumentsForUserService(req.user.id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Documents fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getDocumentMetaController = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const data = await getDocumentMetaService(documentId, req.user.id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Document fetched successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getDocumentFileController = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const doc = await getDocumentMetaService(documentId, req.user.id);
    const absolutePath = path.join(UPLOADS_BASE, doc.storage_path);

    res.sendFile(absolutePath, err => {
      if (err) next(err);
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDocumentController = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const data = await deleteDocumentService(documentId, req.user.id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Document deleted successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const searchInDocumentController = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { query } = req.query;
    const k = req.query.k ? parseInt(req.query.k, 10) : undefined;

    const data = await searchInDocumentService(documentId, req.user.id, query, k);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Ranked chunk excerpts',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const queryDocumentController = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { query } = req.body;

    const data = await queryDocumentService(documentId, req.user.id, query);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Answer and citations',
      data,
    });
  } catch (error) {
    next(error);
  }
};

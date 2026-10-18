import { apiClient } from '../core/api.client.js';

/**
 * @typedef {import('../../types/forum.js').RagDocument} RagDocument
 * @typedef {import('../../types/forum.js').RagSearchHit} RagSearchHit
 * @typedef {import('../../types/forum.js').RagQueryResult} RagQueryResult
 */

/**
 * Turns an axios failure into an Error with a readable message.
 *
 * @param {import('axios').AxiosError<{msg?: string, message?: string}> | Error} error - The caught request error.
 * @param {string} fallback - Message used when the server sends none.
 * @returns {Error} Error whose `.message` can be shown in the UI.
 */
const toServiceError = (error, fallback) => {
  const message =
    error.response?.data?.msg || error.response?.data?.message || fallback;
  return new Error(message);
};

/**
 * Normalizes snake_case or camelCase document payloads.
 *
 * @param {Object} row - API document object.
 * @returns {RagDocument} Frontend document.
 */
const mapDocument = row => ({
  documentId: Number(row.documentId ?? row.document_id),
  title: row.title,
  mimeType: row.mimeType ?? row.mime_type,
  byteSize: Number(row.byteSize ?? row.byte_size ?? 0),
  status: row.status,
  errorMessage: row.errorMessage ?? row.error_message ?? null,
  createdAt: row.createdAt ?? row.created_at,
  updatedAt: row.updatedAt ?? row.updated_at,
});

/**
 * Lists the signed-in user's PDFs (GET /api/rag/documents).
 *
 * @returns {Promise<RagDocument[]>} Newest first.
 */
export async function listDocuments() {
  try {
    const response = await apiClient.get('/api/rag/documents');
    const rows = Array.isArray(response.data.data) ? response.data.data : [];
    return rows.map(mapDocument);
  } catch (error) {
    throw toServiceError(error, 'Failed to load documents.');
  }
}

/**
 * Uploads a PDF and indexes it (POST /api/rag/documents).
 *
 * @param {File} file - PDF chosen in the library form.
 * @returns {Promise<RagDocument>} The processed document.
 */
export async function uploadPdf(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post('/api/rag/documents', formData, {
      timeout: 180000,
      transformRequest: [
        (data, headers) => {
          if (headers && typeof headers.delete === 'function') {
            headers.delete('Content-Type');
          } else if (headers) {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    });
    return mapDocument(response.data.data);
  } catch (error) {
    throw toServiceError(error, 'Failed to upload PDF.');
  }
}

/**
 * Deletes one PDF (DELETE /api/rag/documents/:documentId).
 *
 * @param {number} documentId - Document to remove.
 * @returns {Promise<void>}
 */
export async function deleteDocument(documentId) {
  try {
    await apiClient.delete(`/api/rag/documents/${documentId}`);
  } catch (error) {
    throw toServiceError(error, 'Failed to delete document.');
  }
}

/**
 * Semantic search inside one PDF (GET /api/rag/documents/:documentId/search).
 *
 * @param {number} documentId - Document to search.
 * @param {string} query - Natural-language query.
 * @returns {Promise<{query: string, results: RagSearchHit[]}>} Ranked excerpts.
 */
export async function searchInDocument(documentId, query) {
  try {
    const response = await apiClient.get(
      `/api/rag/documents/${documentId}/search`,
      {
        params: { query },
        timeout: 60000,
      },
    );
    return response.data.data;
  } catch (error) {
    throw toServiceError(error, 'Failed to search this document.');
  }
}

/**
 * Ask AI grounded in one PDF (POST /api/rag/documents/:documentId/query).
 *
 * @param {number} documentId - Document to query.
 * @param {string} query - User question.
 * @returns {Promise<RagQueryResult>} Answer and citations.
 */
export async function queryDocument(documentId, query) {
  try {
    const response = await apiClient.post(
      `/api/rag/documents/${documentId}/query`,
      { query },
      { timeout: 60000 },
    );
    return response.data.data;
  } catch (error) {
    throw toServiceError(error, 'Could not get an answer.');
  }
}

/**
 * Fetches the PDF as a blob URL for the reader iframe.
 *
 * @param {number} documentId - Document to preview.
 * @returns {Promise<string>} Object URL; caller must revoke it.
 */
export async function fetchPdfObjectUrl(documentId) {
  try {
    const response = await apiClient.get(
      `/api/rag/documents/${documentId}/file`,
      {
        responseType: 'blob',
        timeout: 60000,
      },
    );

    if (response.data?.type === 'application/json') {
      throw new Error('Could not load PDF preview.');
    }

    return URL.createObjectURL(response.data);
  } catch (error) {
    throw toServiceError(error, 'Could not load PDF preview.');
  }
}

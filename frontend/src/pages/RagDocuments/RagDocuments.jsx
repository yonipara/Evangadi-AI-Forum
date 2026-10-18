/**
 * Knowledge Base: private PDF library (`/rag-documents`).
 * Upload, preview, semantic search, and Ask AI against one selected file.
 *
 * Data: `rag.service.js`.
 *
 * @typedef {import('../../types/forum.js').RagDocument} RagDocument
 * @typedef {import('../../types/forum.js').RagSearchHit} RagSearchHit
 */
import { useEffect, useRef, useState } from 'react';
import { FileUp, Sparkles, Trash2, Upload } from 'lucide-react';
import RagAnswerBody from '../../components/RagAnswerBody/RagAnswerBody.jsx';
import {
  deleteDocument,
  fetchPdfObjectUrl,
  listDocuments,
  queryDocument,
  searchInDocument,
  uploadPdf,
} from '../../services/rag/rag.service.js';
import styles from './RagDocuments.module.css';

/**
 * Knowledge Base page matching the private PDF library snippets.
 *
 * @returns {JSX.Element} Library column, reader, search, and Ask AI.
 */
export default function RagDocuments() {
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const previewUrlRef = useRef(/** @type {string | null} */ (null));
  const localPreviewDocIdRef = useRef(/** @type {number | null} */ (null));

  const [documents, setDocuments] = useState(/** @type {RagDocument[]} */ ([]));
  const [selectedId, setSelectedId] = useState(/** @type {number | null} */ (null));
  const [previewUrl, setPreviewUrl] = useState(/** @type {string | null} */ (null));
  const [pickedFile, setPickedFile] = useState(/** @type {File | null} */ (null));
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [listError, setListError] = useState(/** @type {string | null} */ (null));
  const [uploadError, setUploadError] = useState(/** @type {string | null} */ (null));

  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState(/** @type {RagSearchHit[]} */ ([]));
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(/** @type {string | null} */ (null));

  const [askQuery, setAskQuery] = useState('');
  const [askAnswer, setAskAnswer] = useState(/** @type {string | null} */ (null));
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState(/** @type {string | null} */ (null));

  const selected = documents.find(doc => doc.documentId === selectedId) || null;
  const canUseSelected = selected?.status === 'ready';

  /**
   * Loads the library list.
   *
   * @returns {Promise<void>}
   */
  const loadDocuments = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const rows = await listDocuments();
      setDocuments(rows);
      setSelectedId(current => {
        if (current && rows.some(row => row.documentId === current)) {
          return current;
        }
        return rows[0]?.documentId ?? null;
      });
    } catch (error) {
      setListError(error.message || 'Failed to load documents.');
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    const loadPreview = async () => {
      // Keep the local blob for the doc that was just uploaded this session.
      if (selectedId && selectedId === localPreviewDocIdRef.current) return;

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
      localPreviewDocIdRef.current = null;

      if (!selectedId || selected?.status === 'failed') return;

      try {
        const objectUrl = await fetchPdfObjectUrl(selectedId);
        previewUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
      } catch {
        setPreviewUrl(null);
      }
    };

    loadPreview();

    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [selectedId, selected?.status]);

  /**
   * Uploads the chosen PDF.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event - Submit event.
   * @returns {Promise<void>}
   */
  const handleUpload = async event => {
    event.preventDefault();
    if (!pickedFile) {
      setUploadError('Choose a PDF first.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const created = await uploadPdf(pickedFile);
      setDocuments(current => [
        created,
        ...current.filter(doc => doc.documentId !== created.documentId),
      ]);
      // Mark before setSelectedId so the effect sees it synchronously via ref.
      localPreviewDocIdRef.current = created.documentId;
      setSelectedId(created.documentId);
      setPickedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadError(error.message || 'Failed to upload PDF.');
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Removes a PDF from the library.
   *
   * @param {number} documentId - Document to delete.
   * @returns {Promise<void>}
   */
  const handleDelete = async documentId => {
    try {
      await deleteDocument(documentId);
      setDocuments(current => current.filter(doc => doc.documentId !== documentId));
      setSelectedId(current => (current === documentId ? null : current));
    } catch (error) {
      setListError(error.message || 'Failed to delete document.');
    }
  };

  /**
   * Empties the search query and any passages already shown.
   *
   * @returns {void}
   */
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchHits([]);
    setSearchError(null);
  };

  /**
   * Runs semantic search on the selected PDF.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event - Submit event.
   * @returns {Promise<void>}
   */
  const handleSearch = async event => {
    event.preventDefault();
    if (!canUseSelected || !selectedId) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const data = await searchInDocument(selectedId, searchQuery.trim());
      setSearchHits(Array.isArray(data?.results) ? data.results : []);
    } catch (error) {
      setSearchHits([]);
      setSearchError(error.message || 'Failed to search this document.');
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Empties the question box and any answer already shown.
   *
   * @returns {void}
   */
  const handleClearAsk = () => {
    setAskQuery('');
    setAskAnswer(null);
    setAskError(null);
  };

  /**
   * Empties both the search box and the question box, including their results.
   *
   * @returns {void}
   */
  const handleClearAll = () => {
    handleClearSearch();
    handleClearAsk();
  };

  const searchHasContent =
    searchQuery.length > 0 || searchHits.length > 0 || Boolean(searchError);
  const askHasContent = Boolean(askQuery || askAnswer || askError);

  /**
   * Asks the model a question grounded in the selected PDF.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event - Submit event.
   * @returns {Promise<void>}
   */
  const handleAsk = async event => {
    event.preventDefault();
    if (!canUseSelected || !selectedId) {
      return;
    }

    setIsAsking(true);
    setAskError(null);
    setAskAnswer(null);
    try {
      const data = await queryDocument(selectedId, askQuery.trim());
      setAskAnswer(data?.answer || '');
    } catch (error) {
      setAskError(error.message || 'Could not get an answer.');
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className={styles.rag}>
      <section className={styles.rag__hero} aria-labelledby='rag-heading'>
        <p className={styles.rag__eyebrow}>Knowledge base</p>
        <h3 id='rag-heading' className={styles.rag__heading}>
          Private PDF library
        </h3>
        <p className={styles.rag__lede}>
          Upload study or reference PDFs to your own workspace. Each file is
          indexed for semantic search and optional AI answers that cite passages
          from that document only. File size limits apply on the server; other
          users never see your uploads.
        </p>
      </section>

      <div className={styles.rag__grid}>
        <section className={styles.rag__card} aria-labelledby='rag-library'>
          <h4 id='rag-library' className={styles.rag__cardTitle}>
            Library
          </h4>
          <p className={styles.rag__cardCopy}>
            Add PDFs here. Processing runs once per upload.
          </p>

          <form className={styles.rag__upload} onSubmit={handleUpload}>
            <p className={styles.rag__hint}>
              Accepted format: PDF. Maximum file size is enforced by the server.
            </p>
            <div className={styles.rag__uploadRow}>
              <label className={styles.rag__choose}>
                <FileUp size={16} strokeWidth={2.25} aria-hidden />
                Choose file
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='application/pdf,.pdf'
                  className={styles.rag__fileInput}
                  onChange={event => {
                    const file = event.target.files?.[0] ?? null;
                    setPickedFile(file);
                    setUploadError(null);
                    localPreviewDocIdRef.current = null;
                    if (previewUrlRef.current) {
                      URL.revokeObjectURL(previewUrlRef.current);
                    }
                    if (file) {
                      const url = URL.createObjectURL(file);
                      previewUrlRef.current = url;
                      setPreviewUrl(url);
                    } else {
                      previewUrlRef.current = null;
                      setPreviewUrl(null);
                    }
                  }}
                />
              </label>
              <button
                type='submit'
                className={styles.rag__primary}
                disabled={isUploading}
              >
                <Upload size={16} strokeWidth={2.25} aria-hidden />
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
            <p className={styles.rag__fileName}>
              {pickedFile ? pickedFile.name : 'No file selected.'}
            </p>
            {uploadError ? (
              <p className={styles.rag__error} role='alert'>
                {uploadError}
              </p>
            ) : null}
          </form>

          {isLoading ? (
            <p className={styles.rag__muted}>Loading your library...</p>
          ) : null}

          {listError ? (
            <p className={styles.rag__error} role='alert'>
              {listError}
            </p>
          ) : null}

          {!isLoading && documents.length === 0 ? (
            <p className={styles.rag__muted}>No PDFs yet. Upload one to start.</p>
          ) : null}

          <ul className={styles.rag__list}>
            {documents.map(doc => {
              const isActive = doc.documentId === selectedId;
              return (
                <li key={doc.documentId} className={styles.rag__docWrap}>
                  <button
                    type='button'
                    className={`${styles.rag__doc} ${
                      isActive ? styles['rag__doc--active'] : ''
                    }`}
                    onClick={() => {
                      setSelectedId(doc.documentId);
                      setSearchHits([]);
                      setSearchError(null);
                      setAskAnswer(null);
                      setAskError(null);
                    }}
                  >
                    <span className={styles.rag__docTitle}>{doc.title}</span>
                    <span
                      className={`${styles.rag__badge} ${
                        styles[`rag__badge--${doc.status}`] || ''
                      }`}
                    >
                      {doc.status}
                    </span>
                  </button>
                  <button
                    type='button'
                    className={styles.rag__delete}
                    aria-label={`Delete ${doc.title}`}
                    onClick={() => handleDelete(doc.documentId)}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.rag__card} aria-labelledby='rag-reader'>
          <h4 id='rag-reader' className={styles.rag__cardTitle}>
            Reader
          </h4>
          <p className={styles.rag__cardCopy}>
            Inline preview of the selected PDF.
          </p>
          <div className={styles.rag__preview}>
            {previewUrl ? (
              <iframe
                title={selected?.title || 'PDF preview'}
                src={previewUrl}
                className={styles.rag__iframe}
              />
            ) : (
              <div className={styles.rag__previewEmpty} />
            )}
          </div>

          <div className={styles.rag__panel}>
            <h4 className={styles.rag__cardTitle} id='rag-search'>
              Semantic search
            </h4>
            <p className={styles.rag__cardCopy}>
              Finds passages by meaning (embeddings), not only exact keywords.
            </p>
            <form className={styles.rag__stack} onSubmit={handleSearch}>
              <label className={styles.rag__label} htmlFor='rag-search-query'>
                Search query
              </label>
              <input
                id='rag-search-query'
                className={styles.rag__input}
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder='Describe the topic or phrase you are looking for'
                disabled={!canUseSelected || isSearching}
              />
              <div className={styles.rag__actions}>
                <button
                  type='submit'
                  className={styles.rag__primary}
                  disabled={
                    !canUseSelected || isSearching || searchQuery.trim().length < 3
                  }
                >
                  <Sparkles size={16} strokeWidth={2.25} aria-hidden />
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
                <button
                  type='button'
                  className={styles.rag__secondary}
                  onClick={handleClearSearch}
                  disabled={
                    isSearching ||
                    (searchQuery.length === 0 &&
                      searchHits.length === 0 &&
                      !searchError)
                  }
                >
                  Clear
                </button>
              </div>
            </form>
            {searchError ? (
              <p className={styles.rag__error} role='alert'>
                {searchError}
              </p>
            ) : null}
            {searchHits.length > 0 ? (
              <ul className={styles.rag__hits}>
                {searchHits.map(hit => (
                  <li
                    key={`${hit.chunkId}-${hit.chunkIndex}`}
                    className={styles.rag__hit}
                  >
                    <p className={styles.rag__hitScore}>
                      Score {Number(hit.score).toFixed(4)}
                    </p>
                    <p className={styles.rag__hitText}>{hit.excerpt}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className={styles.rag__panel}>
            <h4 className={styles.rag__cardTitle} id='rag-ask'>
              Ask with AI
            </h4>
            <p className={styles.rag__cardCopy}>
              Answers use only retrieved excerpts from this PDF, with citations
              where possible. When the document includes code, the reply may
              show it in formatted blocks you can copy.
            </p>
            <form className={styles.rag__stack} onSubmit={handleAsk}>
              <label className={styles.rag__label} htmlFor='rag-ask-query'>
                Question
              </label>
              <textarea
                id='rag-ask-query'
                className={styles.rag__textarea}
                rows={4}
                value={askQuery}
                onChange={event => setAskQuery(event.target.value)}
                placeholder='What does this PDF recommend for route persistence?'
                disabled={!canUseSelected || isAsking}
              />
              <div className={styles.rag__actions}>
                <button
                  type='submit'
                  className={styles.rag__primary}
                  disabled={
                    !canUseSelected || isAsking || askQuery.trim().length < 3
                  }
                >
                  <Sparkles size={16} strokeWidth={2.25} aria-hidden />
                  {isAsking ? 'Asking...' : 'Ask'}
                </button>
                <button
                  type='button'
                  className={styles.rag__secondary}
                  onClick={handleClearAsk}
                  disabled={
                    isAsking || (!askQuery && !askAnswer && !askError)
                  }
                >
                  Clear
                </button>
              </div>
            </form>
            {askError ? (
              <p className={styles.rag__error} role='alert'>
                {askError}
              </p>
            ) : null}
            {askAnswer ? <RagAnswerBody>{askAnswer}</RagAnswerBody> : null}
          </div>

          <div className={styles.rag__clearAllRow}>
            <button
              type='button'
              className={`${styles.rag__secondary} ${styles.rag__clearAll}`}
              onClick={handleClearAll}
              disabled={
                isSearching || isAsking || (!searchHasContent && !askHasContent)
              }
            >
              Clear all
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}




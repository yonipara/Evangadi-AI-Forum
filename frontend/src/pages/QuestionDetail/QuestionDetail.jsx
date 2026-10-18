import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Sparkles, Pencil, Trash2, Share2, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { questionService } from '../../services/question/question.service';
import { answerService } from '../../services/answer/answer.service';
import { timeAgo } from '../../lib/utils';
import { autoFormatMarkdown } from '../../lib/markdownFormatter';
import HighlightedCodeBlock from '../../components/HighlightedCodeBlock/HighlightedCodeBlock';
import styles from './QuestionDetail.module.css';

const MIN_ANSWER_LENGTH = 20;

const markdownComponents = {
  a: ({ node, ...props }) => (
    <a
      {...props}
      className={styles.markdownLink}
      target={props.href?.startsWith('http') ? '_blank' : undefined}
      rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    />
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ node, inline, className, children, ...props }) => {
    const isFence =
      Boolean(className?.trim()) ||
      (!inline && typeof children === 'string' && children.includes('\n'));

    if (isFence) {
      return (
        <HighlightedCodeBlock className={className}>
          {children}
        </HighlightedCodeBlock>
      );
    }
    return (
      <code className={styles.inlineCode} {...props}>
        {children}
      </code>
    );
  },
};

const AVATAR_PALETTE = [
  '#06b6d4', '#10b981', '#84cc16', '#f59e0b',
  '#8b5cf6', '#3b82f6', '#ec4899', '#f97316',
];

function getAvatarBg(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(firstName = '', lastName = '') {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
}

export default function QuestionDetail() {
  const { questionHash } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [relatedQuestions, setRelatedQuestions] = useState([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [isCheckingFit, setIsCheckingFit] = useState(false);
  const [fitResult, setFitResult] = useState(null);
  const [fitError, setFitError] = useState(null);

  // Edit answer state
  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [editText, setEditText] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);
  const [isEditCheckingFit, setIsEditCheckingFit] = useState(false);
  const [editFitResult, setEditFitResult] = useState(null);
  const [editFitError, setEditFitError] = useState(null);
  const [deletingAnswerId, setDeletingAnswerId] = useState(null);

  // Fetch question + answers
  useEffect(() => {
    let cancelled = false;
    async function fetchQuestion() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await questionService.getSingleQuestion(questionHash);
        if (!cancelled) {
          setQuestion(data.question);
          setAnswers(data.answers || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load question.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchQuestion();
    return () => { cancelled = true; };
  }, [questionHash]);

  // Fetch related questions once the main question loads
  useEffect(() => {
    if (!questionHash) return;
    let cancelled = false;
    async function fetchRelated() {
      setIsLoadingRelated(true);
      try {
        const result = await questionService.getSimilarQuestions(questionHash, { k: 5 });
        if (!cancelled) setRelatedQuestions(result.data);
      } catch {
        // Related questions are non-critical — fail silently
      } finally {
        if (!cancelled) setIsLoadingRelated(false);
      }
    }
    fetchRelated();
    return () => { cancelled = true; };
  }, [questionHash]);

  const handleCheckFit = useCallback(async () => {
    if (answerText.length < MIN_ANSWER_LENGTH) return;
    setIsCheckingFit(true);
    setFitResult(null);
    setFitError(null);
    try {
      const data = await questionService.assessAnswerFit(questionHash, answerText);
      setFitResult(data.data);
    } catch (err) {
      setFitError(err.message || 'Could not check answer fit.');
    } finally {
      setIsCheckingFit(false);
    }
  }, [answerText, questionHash]);

  const handlePostAnswer = useCallback(async (e) => {
    e.preventDefault();
    if (answerText.length < MIN_ANSWER_LENGTH) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const data = await answerService.postAnswer(question.id, answerText);
      setAnswers(prev => [data.answer, ...prev]);
      setAnswerText('');
      setFitResult(null);
    } catch (err) {
      setSubmitError(
        err.response?.data?.message || 'Failed to post answer. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [answerText, question]);

  const handleEditStart = useCallback((answer) => {
    setEditingAnswerId(answer.id);
    setEditText(answer.content);
    setEditError(null);
    setEditFitResult(null);
    setEditFitError(null);
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingAnswerId(null);
    setEditText('');
    setEditError(null);
    setEditFitResult(null);
    setEditFitError(null);
  }, []);

  const handleEditCheckFit = useCallback(async () => {
    if (editText.length < MIN_ANSWER_LENGTH) return;
    setIsEditCheckingFit(true);
    setEditFitResult(null);
    setEditFitError(null);
    try {
      const data = await questionService.assessAnswerFit(questionHash, editText);
      setEditFitResult(data.data);
    } catch (err) {
      setEditFitError(err.message || 'Could not check answer fit.');
    } finally {
      setIsEditCheckingFit(false);
    }
  }, [editText, questionHash]);

  const handleEditSave = useCallback(async (answerId) => {
    if (editText.length < MIN_ANSWER_LENGTH) return;
    setIsEditSubmitting(true);
    setEditError(null);
    try {
      const data = await answerService.updateAnswer(answerId, editText);
      setAnswers(prev => prev.map(a => a.id === answerId ? data.answer : a));
      setEditingAnswerId(null);
      setEditText('');
      setEditFitResult(null);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update answer.');
    } finally {
      setIsEditSubmitting(false);
    }
  }, [editText]);

  const handleDeleteAnswer = useCallback(async (answerId) => {
    if (!window.confirm('Delete this answer?')) return;
    setDeletingAnswerId(answerId);
    try {
      await answerService.deleteAnswer(answerId);
      setAnswers(prev => prev.filter(a => a.id !== answerId));
    } catch (err) {
      console.error('Failed to delete answer:', err);
    } finally {
      setDeletingAnswerId(null);
    }
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.skeleton} />
          <div className={`${styles.skeleton} ${styles.skeletonShort}`} />
          <div className={styles.skeleton} />
        </div>
        <aside className={styles.sidebar}>
          <div className={`${styles.skeleton} ${styles.skeletonShort}`} />
          <div className={`${styles.skeleton} ${styles.skeletonShort}`} />
        </aside>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.errorBanner}>{error}</div>
        </div>
      </div>
    );
  }

  const isOwnQuestion = question && user && question.author.id === user.id;
  const fitLevelClass =
    fitResult?.level === 'strong' ? styles.fitStrong
    : fitResult?.level === 'partial' ? styles.fitPartial
    : fitResult?.level === 'weak' ? styles.fitWeak
    : '';
  const editFitLevelClass =
    editFitResult?.level === 'strong' ? styles.fitStrong
    : editFitResult?.level === 'partial' ? styles.fitPartial
    : editFitResult?.level === 'weak' ? styles.fitWeak
    : '';

  const authorName = `${question.author.firstName} ${question.author.lastName}`.trim();
  const authorInitials = getInitials(question.author.firstName, question.author.lastName);
  const authorBg = getAvatarBg(authorName);

  return (
    <div className={styles.layout}>

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className={styles.main}>

        <button
          type='button'
          className={styles.backLink}
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={14} />
          Back to feed
        </button>

        {/* Question card */}
        <div className={styles.questionCard}>
          <div className={styles.questionAuthorRow}>
            <div
              className={styles.avatar}
              style={{ backgroundColor: authorBg }}
              aria-hidden='true'
            >
              {authorInitials}
            </div>
            <div className={styles.authorInfoCol}>
              <span className={styles.authorNameText}>{authorName}</span>
              <span className={styles.questionMeta}>Posted {timeAgo(question.createdAt)}</span>
            </div>
          </div>

          <h1 className={styles.questionTitle}>{question.title}</h1>

          <div className={styles.questionBody}>
            <ReactMarkdown components={markdownComponents}>
              {autoFormatMarkdown(question.content)}
            </ReactMarkdown>
          </div>

          <div className={styles.questionFooterBar}>
            <button
              type='button'
              className={styles.actionPill}
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard!');
                }
              }}
            >
              <Share2 size={13} />
              Share
            </button>
            <button
              type='button'
              className={styles.actionPill}
              onClick={() => {
                document.getElementById('post-answer-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <MessageSquare size={13} />
              {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
            </button>
          </div>
        </div>

        {/* Community Answers */}
        <section className={styles.answersSection}>
          <h2 className={styles.sectionHeading}>
            Community Answers ({answers.length})
          </h2>

          {answers.length === 0 ? (
            <p className={styles.emptyNote}>No answers yet — be the first!</p>
          ) : (
            <ul className={styles.answerList}>
              {answers.map(answer => {
                const aName = `${answer.author.firstName} ${answer.author.lastName}`.trim();
                const isOwnAnswer = user && answer.author.id === user.id;
                const isEditing = editingAnswerId === answer.id;
                return (
                  <li key={answer.id} className={styles.answerCard}>
                    <div className={styles.answerAuthorRow}>
                      <div
                        className={`${styles.avatar} ${styles.avatarSm}`}
                        style={{ backgroundColor: getAvatarBg(aName) }}
                        aria-hidden='true'
                      >
                        {getInitials(answer.author.firstName, answer.author.lastName)}
                      </div>
                      <div className={styles.authorInfoCol}>
                        <span className={styles.authorNameText}>{aName}</span>
                        <span className={styles.answerMeta}>
                          {timeAgo(answer.createdAt)}
                          {answer.updatedAt && answer.updatedAt !== answer.createdAt && (
                            <span className={styles.editedBadge}> (edited)</span>
                          )}
                        </span>
                      </div>
                      {isOwnAnswer && !isEditing && (
                        <div className={styles.answerActions}>
                          <button
                            type='button'
                            className={styles.answerActionBtn}
                            onClick={() => handleEditStart(answer)}
                            title='Edit answer'
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            type='button'
                            className={`${styles.answerActionBtn} ${styles.answerActionBtnDanger}`}
                            onClick={() => handleDeleteAnswer(answer.id)}
                            disabled={deletingAnswerId === answer.id}
                            title='Delete answer'
                          >
                            <Trash2 size={12} />
                            {deletingAnswerId === answer.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className={styles.editForm}>
                        <textarea
                          className={styles.answerTextarea}
                          value={editText}
                          onChange={e => {
                            setEditText(e.target.value);
                            setEditFitResult(null);
                          }}
                          rows={5}
                          disabled={isEditSubmitting}
                        />
                        {editFitResult && (
                          <div className={`${styles.fitPanel} ${editFitLevelClass}`}>
                            <strong>AI Answer Fit: {editFitResult.level}</strong>
                            <p>{editFitResult.note}</p>
                          </div>
                        )}
                        {editFitError && <p className={styles.errorText}>{editFitError}</p>}
                        {editError && <p className={styles.errorText}>{editError}</p>}
                        <div className={styles.formActions}>
                          <button
                            type='button'
                            onClick={handleEditCheckFit}
                            disabled={editText.length < MIN_ANSWER_LENGTH || isEditCheckingFit || isEditSubmitting}
                            className={`${styles.btn} ${styles.btnSecondary}`}
                          >
                            <Sparkles size={13} />
                            {isEditCheckingFit ? 'Checking…' : 'Check Answer Fit'}
                          </button>
                          <button
                            type='button'
                            onClick={handleEditCancel}
                            disabled={isEditSubmitting}
                            className={`${styles.btn} ${styles.btnSecondary}`}
                          >
                            Cancel
                          </button>
                          <button
                            type='button'
                            onClick={() => handleEditSave(answer.id)}
                            disabled={editText.length < MIN_ANSWER_LENGTH || isEditSubmitting}
                            className={`${styles.btn} ${styles.btnPrimary}`}
                          >
                            {isEditSubmitting ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.answerBody}>
                        <ReactMarkdown components={markdownComponents}>
                          {autoFormatMarkdown(answer.content)}
                        </ReactMarkdown>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Post Answer */}
        {isOwnQuestion ? (
          <p className={styles.ownQuestionNote}>You cannot answer your own question.</p>
        ) : (
          <section id='post-answer-section' className={styles.postAnswerSection}>
            <h2 className={styles.sectionHeading}>Your Answer</h2>
            <form onSubmit={handlePostAnswer} className={styles.answerForm}>
              <textarea
                className={styles.answerTextarea}
                value={answerText}
                onChange={e => {
                  setAnswerText(e.target.value);
                  setFitResult(null);
                }}
                placeholder='Write your answer here (min 20 characters)...'
                rows={6}
                disabled={isSubmitting}
              />

              {fitResult && (
                <div className={`${styles.fitPanel} ${fitLevelClass}`}>
                  <strong>AI Answer Fit: {fitResult.level}</strong>
                  <p>{fitResult.note}</p>
                </div>
              )}

              {fitError && <p className={styles.errorText}>{fitError}</p>}
              {submitError && <p className={styles.errorText}>{submitError}</p>}

              <div className={styles.formActions}>
                <button
                  type='button'
                  onClick={handleCheckFit}
                  disabled={answerText.length < MIN_ANSWER_LENGTH || isCheckingFit || isSubmitting}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  <Sparkles size={13} />
                  {isCheckingFit ? 'Checking...' : 'Check Answer Fit'}
                </button>
                <button
                  type='submit'
                  disabled={answerText.length < MIN_ANSWER_LENGTH || isSubmitting || isCheckingFit}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {isSubmitting ? 'Posting...' : 'Post Answer'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {/* ── Related Questions sidebar ────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.relatedPanel}>
          <h3 className={styles.relatedTitle}>Related Questions</h3>

          {isLoadingRelated ? (
            <>
              <div className={`${styles.skeleton} ${styles.skeletonRelated}`} />
              <div className={`${styles.skeleton} ${styles.skeletonRelated}`} />
              <div className={`${styles.skeleton} ${styles.skeletonRelated}`} />
            </>
          ) : relatedQuestions.length === 0 ? (
            <p className={styles.relatedEmpty}>No related questions found.</p>
          ) : (
            <ul className={styles.relatedList}>
              {relatedQuestions.map(q => (
                <li key={q.id} className={styles.relatedItem}>
                  <Link
                    to={`/questions/${q.questionHash}`}
                    className={styles.relatedLink}
                  >
                    <p className={styles.relatedItemTitle}>{q.title}</p>
                    <div className={styles.relatedItemMetaRow}>
                      <span className={styles.relatedItemMeta}>
                        {q.author?.firstName} {q.author?.lastName}
                      </span>
                      <span className={styles.relatedItemDate}>
                        {timeAgo(q.createdAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

    </div>
  );
}

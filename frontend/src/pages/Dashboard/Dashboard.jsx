import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  SquarePen,
  BarChart3,
  BookOpen,
  MessageSquare,
  Sparkles,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { questionService } from '../../services/question/question.service';
import { timeAgo, isAuthoredByUser } from '../../lib/utils';
import styles from './Dashboard.module.css';

/**
 * Palette for deterministic, accessible avatar backgrounds.
 */
const AVATAR_PALETTE = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald / Mint
  '#84cc16', // Lime
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#f97316', // Orange
];

/**
 * Computes a deterministic background color from a string identifier.
 * @param {string} identifier
 * @returns {string} Hex color string
 */
function getAvatarBgColor(identifier = '') {
  let hash = 0;
  for (let i = 0; i < identifier.length; i += 1) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

/**
 * Extracts 2-letter uppercase initials from names.
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string}
 */
function getInitials(firstName = '', lastName = '') {
  const first = firstName?.trim()?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.trim()?.charAt(0)?.toUpperCase() || '';
  return first + last || 'U';
}

/**
 * Strips raw markdown syntax for a clean card snippet preview.
 * @param {string} text
 * @returns {string}
 */
function cleanPreviewText(text = '') {
  if (!text) return '';
  return text
    .replace(/^#+\s+/gm, '') // Remove heading markers
    .replace(/```[\s\S]*?```/g, '') // Remove fenced code blocks
    .replace(/`([^`]+)`/g, '$1') // Clean inline code backticks
    .replace(/[*_~[\]()]/g, '') // Remove markdown formatting characters
    .replace(/\s+/g, ' ') // Collapse excess whitespace
    .trim();
}

/**
 * Dashboard Page (Task T-14).
 * Main community home: displays welcome hero, quick action cards,
 * live feed statistics, and discussion list with keyword & semantic search.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Extract URL search parameters
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const keywordQuery = queryParams.get('q') || '';
  const semanticQuery = queryParams.get('semantic') || '';

  const searchMode = semanticQuery
    ? 'semantic'
    : keywordQuery
    ? 'keyword'
    : 'all';

  /**
   * Fetches questions matching the current search parameters.
   * The `isCancelled` ref is owned by the effect so cleanup can flip it
   * before any in-flight setState calls fire.
   */
  const fetchFeedData = useCallback(
    async (signal) => {
      setIsLoading(true);
      setError(null);

      try {
        let result;
        if (searchMode === 'semantic') {
          result = await questionService.searchQuestionsSemantic(semanticQuery);
        } else if (searchMode === 'keyword') {
          result = await questionService.getQuestions({ search: keywordQuery });
        } else {
          result = await questionService.getQuestions();
        }

        if (!signal.cancelled) {
          setQuestions(result?.data || []);
        }
      } catch (err) {
        if (!signal.cancelled) {
          setError(err?.message || 'Failed to load questions.');
          setQuestions([]);
        }
      } finally {
        if (!signal.cancelled) {
          setIsLoading(false);
        }
      }
    },
    [searchMode, semanticQuery, keywordQuery],
  );

  useEffect(() => {
    // Cancellation signal object — flipped to true in the cleanup function
    // so any setState calls from a stale fetch are safely dropped.
    const signal = { cancelled: false };
    fetchFeedData(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [fetchFeedData]);

  // Personalized greeting
  const firstName = user?.firstName?.trim();
  const greeting = firstName
    ? `Good to see you, ${firstName}.`
    : 'Welcome to the forum.';

  // Live feed statistics computed from questions list
  const stats = useMemo(() => {
    const total = questions.length;
    const replies = questions.reduce(
      (sum, q) => sum + (Number(q.answerCount) || 0),
      0,
    );
    const unanswered = questions.filter(
      q => !q.answerCount || Number(q.answerCount) === 0,
    ).length;
    const yours = questions.filter(q => isAuthoredByUser(q, user)).length;

    return { total, replies, unanswered, yours };
  }, [questions, user]);

  /**
   * Navigates to question detail page by hash.
   */
  const handleNavigateToQuestion = useCallback(
    questionHash => {
      if (!questionHash) return;
      navigate(`/questions/${questionHash}`);
    },
    [navigate],
  );

  /**
   * Clears active search parameters from URL.
   */
  const handleClearSearch = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  return (
    <div className={styles.dashboard}>
      {/* ============================================================
          TOP HERO / BANNER SECTION
          ============================================================ */}
      <section className={styles.dashboard__hero} aria-labelledby='hero-title'>
        <span className={styles.dashboard__heroCategory}>Forum Home</span>
        <h1 id='hero-title' className={styles.dashboard__heroTitle}>
          {greeting}
        </h1>
        <p className={styles.dashboard__heroDescription}>
          Start a topic, revisit your own threads, or skim the live feed. Search
          above works from any page once you are back on Home.
        </p>

        {/* 3 Quick Navigation Action Cards */}
        <div className={styles.dashboard__actions}>
          <button
            type='button'
            className={styles.dashboard__actionCard}
            onClick={() => navigate('/questions/ask')}
            aria-label='Post a new question'
          >
            <div className={styles.dashboard__actionIconBox}>
              <SquarePen size={18} aria-hidden='true' />
            </div>
            <div className={styles.dashboard__actionContent}>
              <span className={styles.dashboard__actionTitle}>New question</span>
              <span className={styles.dashboard__actionSubtitle}>
                Share context, errors, and what you already tried
              </span>
            </div>
          </button>

          <button
            type='button'
            className={styles.dashboard__actionCard}
            onClick={() => navigate('/my-questions')}
            aria-label='View your topics'
          >
            <div className={styles.dashboard__actionIconBox}>
              <BarChart3 size={18} aria-hidden='true' />
            </div>
            <div className={styles.dashboard__actionContent}>
              <span className={styles.dashboard__actionTitle}>Your topics</span>
              <span className={styles.dashboard__actionSubtitle}>
                Filtered list of threads you authored
              </span>
            </div>
          </button>

          <button
            type='button'
            className={styles.dashboard__actionCard}
            onClick={() => navigate('/rag-documents')}
            aria-label='Open knowledge base'
          >
            <div className={styles.dashboard__actionIconBox}>
              <BookOpen size={18} aria-hidden='true' />
            </div>
            <div className={styles.dashboard__actionContent}>
              <span className={styles.dashboard__actionTitle}>
                Knowledge base
              </span>
              <span className={styles.dashboard__actionSubtitle}>
                Course library, uploads, and retrieval-backed context for threads
              </span>
            </div>
          </button>
        </div>

        {/* Snapshot Summary Caption */}
        <p className={styles.dashboard__snapshotNote}>
          {isLoading
            ? 'Loading snapshot for the list below...'
            : 'Figures below describe the newest threads in this feed (up to 100 from the API).'}
        </p>

        {/* 4 Metric / Statistics Tiles — always visible; show 0 while loading */}
        <div
          className={styles.dashboard__stats}
          role='region'
          aria-label='Feed Statistics'
          aria-busy={isLoading}
        >
          <div className={styles.dashboard__statCard}>
            <span className={styles.dashboard__statLabel}>Questions</span>
            <span className={styles.dashboard__statValue}>
              {isLoading ? '—' : stats.total}
            </span>
          </div>
          <div className={styles.dashboard__statCard}>
            <span className={styles.dashboard__statLabel}>Replies</span>
            <span className={styles.dashboard__statValue}>
              {isLoading ? '—' : stats.replies}
            </span>
          </div>
          <div className={styles.dashboard__statCard}>
            <span className={styles.dashboard__statLabel}>Unanswered</span>
            <span className={styles.dashboard__statValue}>
              {isLoading ? '—' : stats.unanswered}
            </span>
          </div>
          <div className={styles.dashboard__statCard}>
            <span className={styles.dashboard__statLabel}>Yours</span>
            <span className={styles.dashboard__statValue}>
              {isLoading ? '—' : stats.yours}
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================
          DISCUSSION FEED SECTION
          ============================================================ */}
      <section
        className={styles.dashboard__feed}
        aria-labelledby='feed-heading'
      >
        <div className={styles.dashboard__feedHeader}>
          <div className={styles.dashboard__feedHeaderLeft}>
            <h2 id='feed-heading' className={styles.dashboard__feedTitle}>
              Discussion feed
            </h2>
            <p className={styles.dashboard__feedSubtitle}>
              Your threads use a slim left accent in this list.
            </p>
          </div>

          <div>
            {searchMode === 'semantic' ? (
              <span
                className={`${styles.dashboard__feedBadge} ${styles['dashboard__feedBadge--semantic']}`}
              >
                <Sparkles size={12} aria-hidden='true' />
                <span>AI Search Results</span>
              </span>
            ) : searchMode === 'keyword' ? (
              <span className={styles.dashboard__feedBadge}>
                Keyword Search
              </span>
            ) : (
              <span className={styles.dashboard__feedBadge}>
                Newest Threads
              </span>
            )}
          </div>
        </div>

        {/* FEED BODY STATES */}
        {isLoading ? (
          <div
            className={styles.dashboard__stateContainer}
            aria-live='polite'
            aria-busy='true'
          >
            <p className={styles.dashboard__loadingText}>
              Loading recent questions...
            </p>
          </div>
        ) : error ? (
          <div className={styles.dashboard__stateContainer}>
            <div className={styles.dashboard__errorBox} role='alert'>
              <p>{error}</p>
              <button
                type='button'
                className={styles.dashboard__errorButton}
                onClick={() => {
                  const signal = { cancelled: false };
                  fetchFeedData(signal);
                }}
              >
                <RefreshCw size={12} style={{ marginRight: '0.35rem' }} />
                Try again
              </button>
            </div>
          </div>
        ) : questions.length === 0 ? (
          <div className={styles.dashboard__stateContainer}>
            <div className={styles.dashboard__emptyBox}>
              <p>
                {searchMode !== 'all'
                  ? `No questions found matching "${
                      semanticQuery || keywordQuery
                    }".`
                  : 'No questions found. Be the first to ask!'}
              </p>
              {searchMode !== 'all' && (
                <button
                  type='button'
                  className={styles.dashboard__clearButton}
                  onClick={handleClearSearch}
                >
                  <XCircle size={12} style={{ marginRight: '0.35rem' }} />
                  Clear search
                </button>
              )}
            </div>
          </div>
        ) : (
          <ul
            className={styles.dashboard__list}
            role='list'
            aria-label='Questions List'
          >
            {questions.map(question => {
              const isOwner = isAuthoredByUser(question, user);
              const authorFirstName = question.author?.firstName || '';
              const authorLastName = question.author?.lastName || '';
              const fullName = `${authorFirstName} ${authorLastName}`.trim();
              const authorInitials = getInitials(
                authorFirstName,
                authorLastName,
              );
              const authorBg = getAvatarBgColor(fullName || 'User');
              const authorDisplay = isOwner
                ? 'You'
                : fullName || 'Anonymous';
              const cleanSnippet = cleanPreviewText(question.content);

              return (
                <li
                  key={question.id || question.questionHash}
                  className={`${styles.dashboard__item} ${
                    isOwner ? styles['dashboard__item--isOwner'] : ''
                  }`}
                  onClick={() =>
                    handleNavigateToQuestion(question.questionHash)
                  }
                  tabIndex={0}
                  role='button'
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateToQuestion(question.questionHash);
                    }
                  }}
                  aria-label={`View question: ${question.title}`}
                >
                  {/* Author Avatar Initials */}
                  <div
                    className={styles.dashboard__avatar}
                    style={{ backgroundColor: authorBg }}
                    aria-hidden='true'
                  >
                    {authorInitials}
                  </div>

                  {/* Question Content Column */}
                  <div className={styles.dashboard__contentColumn}>
                    <div className={styles.dashboard__itemTopRow}>
                      <h3
                        className={styles.dashboard__itemTitle}
                        title={question.title}
                      >
                        {question.title}
                      </h3>
                      {isOwner && (
                        <span className={styles.dashboard__yoursBadge}>
                          Yours
                        </span>
                      )}
                    </div>

                    {cleanSnippet && (
                      <p className={styles.dashboard__itemSnippet}>
                        {cleanSnippet}
                      </p>
                    )}

                    <div className={styles.dashboard__itemMetaRow}>
                      <span className={styles.dashboard__replyCount}>
                        <MessageSquare size={13} aria-hidden='true' />
                        <span>{question.answerCount || 0} replies</span>
                      </span>

                      <span className={styles.dashboard__authorDate}>
                        {timeAgo(question.createdAt)} by {authorDisplay}
                      </span>

                      {question.score !== undefined && (
                        <span className={styles.dashboard__semanticScore}>
                          <Sparkles size={11} aria-hidden='true' />
                          <span>
                            {Math.round(Number(question.score) * 100)}% match
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

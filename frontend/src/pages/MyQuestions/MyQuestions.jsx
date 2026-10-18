import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { questionService } from '../../services/question/question.service';
import styles from './MyQuestions.module.css';

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  if (diffWeeks > 0) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

function getInitials(firstName = '', lastName = '') {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?';
}

export default function MyQuestions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await questionService.getQuestions({ mine: true });
        if (!cancelled) setQuestions(result.data || []);
      } catch (err) {
        if (!cancelled)
          setError(
            err.response?.data?.message || 'Failed to load your questions.',
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const initials = getInitials(user?.firstName, user?.lastName);

  return (
    <div className={styles.page}>
      <div className={styles.page__header}>
        <div className={styles.page__headerText}>
          <span className={styles.page__tag}>YOUR WORKSPACE</span>
          <h1 className={styles.page__title}>Your topics</h1>
          <p className={styles.page__desc}>
            Only questions you created. Open one to read answers or add
            follow-ups. Rows use the same left accent as your threads on Home.
          </p>
        </div>
        <button
          className={styles.page__newBtn}
          onClick={() => navigate('/questions/ask')}
        >
          + New question
        </button>
      </div>

      <div className={styles.content}>
        {isLoading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading your questions…</span>
          </div>
        )}

        {!isLoading && error && (
          <div className={styles.error}>
            <span>{error}</span>
            <button onClick={() => setRetryCount(c => c + 1)}>Retry</button>
          </div>
        )}

        {!isLoading && !error && questions.length === 0 && (
          <div className={styles.empty}>
            <p>
              You have not asked any questions yet. Use Ask a Question in the
              sidebar to start.
            </p>
          </div>
        )}

        {!isLoading && !error && questions.length > 0 && (
          <ul className={styles.list}>
            {questions.map(q => (
              <li
                key={q.questionHash || q.id}
                className={styles.card}
                onClick={() => navigate(`/questions/${q.questionHash}`)}
                role='button'
                tabIndex={0}
                onKeyDown={e =>
                  e.key === 'Enter' &&
                  navigate(`/questions/${q.questionHash}`)
                }
              >
                <div className={styles.card__avatar}>{initials}</div>
                <div className={styles.card__body}>
                  <div className={styles.card__topRow}>
                    <h3 className={styles.card__title}>{q.title}</h3>
                    <span className={styles.card__badge}>YOURS</span>
                  </div>
                  {q.content && (
                    <p className={styles.card__excerpt}>
                      {q.content.length > 150
                        ? `${q.content.slice(0, 150)}…`
                        : q.content}
                    </p>
                  )}
                  <div className={styles.card__meta}>
                    <span>
                      {q.answerCount ?? 0}{' '}
                      {(q.answerCount ?? 0) === 1 ? 'reply' : 'replies'}
                    </span>
                    {q.createdAt && (
                      <span>{formatRelativeTime(q.createdAt)} by You</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

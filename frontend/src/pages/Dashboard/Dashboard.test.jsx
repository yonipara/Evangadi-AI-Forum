import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useAuth } from '../../contexts/AuthContext';
import { questionService } from '../../services/question/question.service';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/question/question.service', () => ({
  questionService: {
    getQuestions: vi.fn(),
    searchQuestionsSemantic: vi.fn(),
  },
}));

const mockUser = {
  id: 1,
  firstName: 'Abebe',
  lastName: 'Kebede',
  email: 'abebe@example.com',
};

function renderDashboard(route = '/dashboard', currentUser = mockUser) {
  useAuth.mockReturnValue({
    user: currentUser,
    isAuthenticated: !!currentUser,
    logout: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={[route]}>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe('Dashboard Component (Task T-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders greeting, quick action buttons, and loading state initially', async () => {
    questionService.getQuestions.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: [] }), 200)),
    );

    renderDashboard();

    expect(screen.getByText('Forum Home')).toBeInTheDocument();
    expect(screen.getByText('Good to see you, Abebe.')).toBeInTheDocument();
    expect(screen.getByText('New question')).toBeInTheDocument();
    expect(screen.getByText('Your topics')).toBeInTheDocument();
    expect(screen.getByText('Knowledge base')).toBeInTheDocument();
    expect(screen.getByText('Loading recent questions...')).toBeInTheDocument();
  });

  it('renders questions list and statistics when data is loaded', async () => {
    const mockQuestions = [
      {
        id: 101,
        questionHash: 'hash101',
        title: 'React Router: useParams() returns undefined',
        content: 'I need help debugging useParams in React Router.',
        answerCount: 3,
        createdAt: new Date().toISOString(),
        author: { id: 1, firstName: 'Abebe', lastName: 'Kebede' },
      },
      {
        id: 102,
        questionHash: 'hash102',
        title: 'How to design a scalable digital menu?',
        content: 'Building a system for restaurants.',
        answerCount: 0,
        createdAt: new Date().toISOString(),
        author: { id: 2, firstName: 'Sara', lastName: 'Smith' },
      },
    ];

    questionService.getQuestions.mockResolvedValueOnce({
      data: mockQuestions,
      meta: { total: 2 },
    });

    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText('React Router: useParams() returns undefined'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('How to design a scalable digital menu?'),
    ).toBeInTheDocument();
    expect(screen.getByText('3 replies')).toBeInTheDocument();
    expect(screen.getByText('0 replies')).toBeInTheDocument();

    // Stats calculations
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByText('Replies')).toBeInTheDocument();
    expect(screen.getByText('Unanswered')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // total questions
    expect(screen.getByText('3')).toBeInTheDocument(); // total replies
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2); // 1 unanswered, 1 yours

    // "Yours" badge on author's question
    expect(screen.getAllByText('Yours').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no questions are returned', async () => {
    questionService.getQuestions.mockResolvedValueOnce({
      data: [],
      meta: { total: 0 },
    });

    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText('No questions found. Be the first to ask!'),
      ).toBeInTheDocument();
    });
  });

  it('renders error state when question fetch fails', async () => {
    questionService.getQuestions.mockRejectedValueOnce(
      new Error('Failed to load questions.'),
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Failed to load questions.')).toBeInTheDocument();
    });
  });

  it('performs semantic search when ?semantic=query is present in URL', async () => {
    const mockSemantic = [
      {
        id: 201,
        questionHash: 'hash201',
        title: 'Semantic Vector Match',
        content: 'Semantic match description',
        answerCount: 1,
        score: 0.92,
        createdAt: new Date().toISOString(),
        author: { id: 3, firstName: 'John', lastName: 'Doe' },
      },
    ];

    questionService.searchQuestionsSemantic.mockResolvedValueOnce({
      data: mockSemantic,
      meta: { total: 1 },
    });

    renderDashboard('/dashboard?semantic=react+router');

    await waitFor(() => {
      expect(questionService.searchQuestionsSemantic).toHaveBeenCalledWith(
        'react router',
      );
      expect(screen.getByText('Semantic Vector Match')).toBeInTheDocument();
      expect(screen.getByText('AI Search Results')).toBeInTheDocument();
      expect(screen.getByText('92% match')).toBeInTheDocument();
    });
  });
});

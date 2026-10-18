import { describe, it, expect, vi, beforeEach } from 'vitest';
import { questionService } from './question.service';
import { apiClient } from '../core/api.client';

vi.mock('../core/api.client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('questionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getQuestions', () => {
    it('fetches questions successfully with default parameters', async () => {
      const mockQuestions = [
        { id: 1, questionHash: 'abc12345', title: 'Test Question', answerCount: 2 },
      ];
      apiClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockQuestions,
          meta: { total: 1, limit: 100 },
        },
      });

      const result = await questionService.getQuestions();
      expect(apiClient.get).toHaveBeenCalledWith('/api/questions', { params: {} });
      expect(result.data).toEqual(mockQuestions);
      expect(result.meta.total).toBe(1);
    });

    it('passes search and mine query parameters when provided', async () => {
      apiClient.get.mockResolvedValueOnce({
        data: { data: [], meta: { total: 0 } },
      });

      await questionService.getQuestions({ search: 'react', mine: true });
      expect(apiClient.get).toHaveBeenCalledWith('/api/questions', {
        params: { search: 'react', mine: true },
      });
    });
  });

  describe('searchQuestionsSemantic', () => {
    it('calls /api/questions/search with query parameter', async () => {
      const mockResults = [
        { id: 2, questionHash: 'def67890', title: 'Semantic match', score: 0.89 },
      ];
      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: mockResults, meta: { total: 1 } },
      });

      const result = await questionService.searchQuestionsSemantic('useState hook');
      expect(apiClient.get).toHaveBeenCalledWith('/api/questions/search', {
        params: { query: 'useState hook' },
      });
      expect(result.data).toEqual(mockResults);
    });
  });

  describe('getSingleQuestion', () => {
    it('fetches question and answers by hash', async () => {
      const mockPayload = {
        question: { id: 1, questionHash: 'hash123', title: 'Detail title' },
        answers: [{ id: 10, content: 'Answer text' }],
      };
      apiClient.get.mockResolvedValueOnce({ data: mockPayload });

      const result = await questionService.getSingleQuestion('hash123');
      expect(apiClient.get).toHaveBeenCalledWith('/api/questions/hash123');
      expect(result.question.title).toBe('Detail title');
      expect(result.answers).toHaveLength(1);
    });
  });

  describe('createQuestion', () => {
    it('posts new question', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: { success: true, message: 'Question posted' },
      });

      const payload = { title: 'How to use Vite?', content: 'Detailed question body text here.' };
      const result = await questionService.createQuestion(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/questions', payload);
      expect(result.success).toBe(true);
    });
  });

  describe('generateQuestionDraftCoach', () => {
    it('calls draft-coach endpoint', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: { success: true, data: { tips: ['Add error logs'] } },
      });

      const result = await questionService.generateQuestionDraftCoach({
        title: 'Draft',
        content: 'Body text',
      });
      expect(apiClient.post).toHaveBeenCalledWith('/api/questions/draft-coach', {
        title: 'Draft',
        content: 'Body text',
      });
      expect(result.data.tips).toContain('Add error logs');
    });
  });

  describe('assessAnswerFit', () => {
    it('calls answer-fit endpoint', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: { success: true, data: { level: 'strong', note: 'Relevant' } },
      });

      const result = await questionService.assessAnswerFit('hash123', 'My answer text here');
      expect(apiClient.post).toHaveBeenCalledWith('/api/questions/hash123/answer-fit', {
        answerText: 'My answer text here',
      });
      expect(result.data.level).toBe('strong');
    });
  });
});

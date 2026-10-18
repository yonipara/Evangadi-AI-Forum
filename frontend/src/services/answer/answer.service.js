import { apiClient } from '../core/api.client.js';

async function postAnswer(questionId, content) {
  const response = await apiClient.post('/api/answers', { questionId, content });
  return response.data;
}

async function updateAnswer(answerId, content) {
  const response = await apiClient.put(`/api/answers/${answerId}`, { content });
  return response.data;
}

async function deleteAnswer(answerId) {
  const response = await apiClient.delete(`/api/answers/${answerId}`);
  return response.data;
}

export const answerService = { postAnswer, updateAnswer, deleteAnswer };

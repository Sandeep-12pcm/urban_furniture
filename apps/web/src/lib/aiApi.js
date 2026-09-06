import { apiRequest } from './api.js';

// Thin client for the read-only AI assistant (Phase 11). Never talks to the
// AI provider directly — the browser only ever calls our own /api/ai/*
// endpoints, which hold the provider key server-side.
export const aiApi = {
  chat: (message, conversationId, context) =>
    apiRequest('/ai/chat', { method: 'POST', body: { message, conversationId, context } }),
  suggestions: () => apiRequest('/ai/suggestions'),
  conversation: (id) => apiRequest(`/ai/conversations/${id}`),
  clearConversation: (id) => apiRequest(`/ai/conversations/${id}`, { method: 'DELETE' }),
};

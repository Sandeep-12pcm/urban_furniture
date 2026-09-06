const { config } = require('../config');

// Thin wrapper around an OpenAI-compatible chat-completions endpoint (xAI's
// Grok API and Groq's API both speak this format). This is the ONLY place
// in the codebase that talks to the AI provider — it never touches the
// database and the database layer never talks to the provider, so a
// provider outage can't corrupt application data and application code never
// needs to know which provider is configured.
//
// Errors are always normalized to `{ type, message }` with a safe,
// user-facing message. The raw provider error, stack trace, and the
// Authorization header are never included.
class AiProviderError extends Error {
  constructor(type, message) {
    super(message);
    this.type = type; // 'not_configured' | 'auth' | 'rate_limit' | 'timeout' | 'network' | 'invalid_response' | 'provider_error'
  }
}

function isConfigured() {
  return config.ai.configured;
}

async function chatCompletion({ messages, tools, maxTokens = 500 }) {
  if (!isConfigured()) {
    throw new AiProviderError('not_configured', 'AI assistant is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.requestTimeoutMs);

  let response;
  try {
    response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages,
        ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
        ...(config.ai.reasoningEffort ? { reasoning_effort: config.ai.reasoningEffort } : {}),
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new AiProviderError('timeout', 'The AI assistant took too long to respond.');
    throw new AiProviderError('network', 'Could not reach the AI assistant provider.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new AiProviderError('auth', 'The AI assistant is misconfigured (invalid credentials).');
  }
  if (response.status === 429) {
    throw new AiProviderError('rate_limit', 'The AI assistant is temporarily busy. Please try again shortly.');
  }
  if (!response.ok) {
    throw new AiProviderError('provider_error', 'The AI assistant provider returned an error.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AiProviderError('invalid_response', 'The AI assistant returned an unreadable response.');
  }

  const choice = payload?.choices?.[0]?.message;
  if (!choice) {
    throw new AiProviderError('invalid_response', 'The AI assistant returned an empty response.');
  }

  return {
    content: choice.content || '',
    toolCalls: choice.tool_calls || [],
    usage: payload.usage || null,
  };
}

module.exports = { chatCompletion, isConfigured, AiProviderError };

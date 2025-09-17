import { type ChatMessage } from "./types";

/**
 * Simple context window management utilities
 * This is a basic implementation to handle context window limits
 */

// Model context window limits (in tokens)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "gpt-3.5-turbo": 4096,
  "gpt-4": 8192,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-5": 200000,
  o3: 200000,
  "claude-3-haiku": 200000,
  "claude-3-sonnet": 200000,
  "claude-3-opus": 200000,
  "claude-sonnet-4": 200000,
  "claude-opus-4": 200000,
  "gemini-pro": 30720,
  "gemini-1.5-pro": 2000000,
  "gemini-2.0-flash": 1000000,
  "mistral-small-latest": 32000,
  "mistral-medium-latest": 32000,
  "mistral-large-latest": 32000,
  llama3: 8192,
  llama2: 4096,
  mistral: 32000,
};

/**
 * Get the context window limit for a model
 */
export function getModelContextLimit(model: string): number {
  // Extract model name from provider/model format
  const modelName = model.includes("/") ? model.split("/")[1] : model;
  return MODEL_CONTEXT_LIMITS[modelName || model] || 4096; // Default to 4K if unknown
}

/**
 * Simple token counting - rough approximation
 * For production use, consider using tiktoken or similar
 */
export function estimateTokenCount(content: string): number {
  if (!content) return 0;

  // Simple approximation: ~4 characters per token for English text
  const charCount = content.length;
  const estimatedTokens = Math.ceil(charCount / 4);

  // Add overhead for special tokens and formatting
  return Math.max(estimatedTokens, 1);
}

/**
 * Estimate tokens for a single message
 */
export function estimateMessageTokens(message: ChatMessage): number {
  // Base tokens for message structure
  let tokens = 3; // role, content, and formatting tokens

  // Add role name tokens
  tokens += message.role.length;

  // Add content tokens
  tokens += estimateTokenCount(message.content);

  // Add name tokens if present
  if (message.name) {
    tokens += message.name.length;
  }

  // Add tool call tokens if present
  if (message.tool_calls) {
    tokens += message.tool_calls.length * 10; // Rough estimate for tool call overhead
    for (const toolCall of message.tool_calls) {
      tokens += toolCall.id.length;
      tokens += toolCall.function.name.length;
      tokens += toolCall.function.arguments.length;
    }
  }

  // Add tool call ID tokens if present
  if (message.tool_call_id) {
    tokens += message.tool_call_id.length;
  }

  return tokens;
}

/**
 * Estimate total tokens for a conversation
 */
export function estimateConversationTokens(messages: ChatMessage[]): number {
  let totalTokens = 0;

  for (const message of messages) {
    totalTokens += estimateMessageTokens(message);
  }

  return totalTokens;
}

/**
 * Check if conversation should be summarized
 */
export function shouldSummarize(
  messages: ChatMessage[],
  model: string,
  safetyMargin: number = 0.8,
): boolean {
  const maxTokens = getModelContextLimit(model);
  const currentTokens = estimateConversationTokens(messages);
  const threshold = Math.floor(maxTokens * safetyMargin);

  return currentTokens > threshold;
}

/**
 * Find the point where summarization should start
 */
export function findSummarizationPoint(
  messages: ChatMessage[],
  model: string,
  targetTokens: number,
): number {
  const maxTokens = getModelContextLimit(model);
  const availableTokens = maxTokens - targetTokens;

  let accumulatedTokens = 0;
  let index = 0;

  // Always keep the first message (usually system message)
  if (messages.length > 0) {
    const firstMessage = messages[0];
    if (firstMessage) {
      accumulatedTokens += estimateMessageTokens(firstMessage);
      index = 1;
    }
  }

  // Find the point where we exceed available tokens
  for (let i = index; i < messages.length; i++) {
    const message = messages[i];
    if (!message) continue;
    const messageTokens = estimateMessageTokens(message);

    if (accumulatedTokens + messageTokens > availableTokens) {
      return i;
    }

    accumulatedTokens += messageTokens;
  }

  // If we can fit all messages, return the last index
  return messages.length;
}

/**
 * Create a simple summary message
 */
export function createSummaryMessage(summarizedCount: number): ChatMessage {
  return {
    role: "assistant",
    content: `[CONVERSATION SUMMARY] Previous ${summarizedCount} messages have been summarized to manage context window. Key points and context preserved.`,
  };
}

/**
 * Summarize conversation by replacing early messages with a summary
 */
export function summarizeConversation(
  messages: ChatMessage[],
  model: string,
  targetTokens?: number,
): ChatMessage[] {
  const maxTokens = getModelContextLimit(model);
  const currentTokens = estimateConversationTokens(messages);

  // If we don't need to summarize, return original messages
  if (!targetTokens || currentTokens <= targetTokens) {
    return messages;
  }

  const actualTargetTokens = targetTokens || Math.floor(maxTokens * 0.6);
  const summarizationPoint = findSummarizationPoint(messages, model, actualTargetTokens);

  if (summarizationPoint <= 1) {
    return messages; // Can't summarize much
  }

  // Create summary and keep recent messages
  const summaryMessage = createSummaryMessage(summarizationPoint);
  const recentMessages = messages.slice(summarizationPoint);

  return [summaryMessage, ...recentMessages];
}

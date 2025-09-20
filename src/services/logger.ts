import { Context, Effect, Layer } from "effect";
import { AgentConfigService, type ConfigService } from "./config";

/**
 * Structured logging service using Effect's Logger
 */

export interface LoggerService {
  readonly debug: (
    message: string,
    meta?: Record<string, unknown>,
  ) => Effect.Effect<void, never, ConfigService>;
  readonly info: (
    message: string,
    meta?: Record<string, unknown>,
  ) => Effect.Effect<void, never, ConfigService>;
  readonly warn: (
    message: string,
    meta?: Record<string, unknown>,
  ) => Effect.Effect<void, never, ConfigService>;
  readonly error: (
    message: string,
    meta?: Record<string, unknown>,
  ) => Effect.Effect<void, never, ConfigService>;
}

export class LoggerServiceImpl implements LoggerService {
  constructor() {}

  debug(
    message: string,
    meta?: Record<string, unknown>,
  ): Effect.Effect<void, never, ConfigService> {
    return Effect.gen(function* () {
      const config = yield* AgentConfigService;
      const loggingConfig = yield* config.get<{ format: "json" | "pretty" }>("logging");
      const format = loggingConfig?.format ?? "pretty";

      const line = formatLogLine("debug", message, meta, format);

      console.debug(line);
      console.log();
    });
  }

  info(message: string, meta?: Record<string, unknown>): Effect.Effect<void, never, ConfigService> {
    return Effect.gen(function* () {
      const config = yield* AgentConfigService;
      const loggingConfig = yield* config.get<{ format: "json" | "pretty" }>("logging");
      const format = loggingConfig?.format ?? "pretty";

      const line = formatLogLine("info", message, meta, format);

      console.info(line);
      console.log();
    });
  }

  warn(message: string, meta?: Record<string, unknown>): Effect.Effect<void, never, ConfigService> {
    return Effect.gen(function* () {
      const config = yield* AgentConfigService;
      const loggingConfig = yield* config.get<{ format: "json" | "pretty" }>("logging");
      const format = loggingConfig?.format ?? "pretty";

      const line = formatLogLine("warn", message, meta, format);

      console.warn(line);
      console.log();
    });
  }

  error(
    message: string,
    meta?: Record<string, unknown>,
  ): Effect.Effect<void, never, ConfigService> {
    return Effect.gen(function* () {
      const config = yield* AgentConfigService;
      const loggingConfig = yield* config.get<{ format: "json" | "pretty" }>("logging");
      const format = loggingConfig?.format ?? "pretty";

      const line = formatLogLine("error", message, meta, format);

      console.error(line);
      console.log();
    });
  }
}

type LogLevel = "debug" | "info" | "warn" | "error";

function formatLogLine(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
  format: "json" | "pretty" = "pretty",
): string {
  const now = new Date();
  const ts = now.toISOString();
  const color = selectColor(level);
  const levelLabel = padLevel(level.toUpperCase());
  const emoji = selectEmoji(level);

  let metaText = "";
  if (meta && Object.keys(meta).length > 0) {
    if (format === "pretty") {
      metaText = dim(" " + prettyPrintJson(meta));
    } else {
      metaText = dim(" " + JSON.stringify(meta));
    }
  }

  const body = indentMultiline(message);
  return `${dim(ts)} ${color(levelLabel)} ${emoji} ${body}${metaText}`;
}

function selectColor(level: LogLevel): (text: string) => string {
  switch (level) {
    case "debug":
      return gray;
    case "info":
      return cyan;
    case "warn":
      return yellow;
    case "error":
      return red;
  }
}

function selectEmoji(level: LogLevel): string {
  switch (level) {
    case "debug":
      return "🔍";
    case "info":
      return "ℹ️";
    case "warn":
      return "⚠️";
    case "error":
      return "❌";
  }
}

function padLevel(level: string): string {
  // Ensures consistent width: DEBUG/ INFO/ WARN/ ERROR
  return level.padEnd(5, " ");
}

function indentMultiline(text: string): string {
  if (!text.includes("\n")) return text;
  const lines = text.split("\n");
  return lines.map((line, idx) => (idx === 0 ? line : "  " + line)).join("\n");
}

function prettyPrintJson(obj: Record<string, unknown>): string {
  try {
    const jsonString = JSON.stringify(obj, null, 2);
    // Add indentation to each line except the first
    const lines = jsonString.split("\n");
    return lines.map((line, idx) => (idx === 0 ? line : "  " + line)).join("\n");
  } catch {
    // Fallback to regular JSON.stringify if pretty printing fails
    return JSON.stringify(obj);
  }
}

// ANSI color helpers (no dependency)
function wrap(open: string, close: string): (text: string) => string {
  const enabled = process.stdout.isTTY === true;
  return (text: string) => (enabled ? `${open}${text}${close}` : text);
}

const dim = wrap("\u001B[2m", "\u001B[22m");
const gray = wrap("\u001B[90m", "\u001B[39m");
const cyan = wrap("\u001B[36m", "\u001B[39m");
const yellow = wrap("\u001B[33m", "\u001B[39m");
const red = wrap("\u001B[31m", "\u001B[39m");

export const LoggerServiceTag = Context.GenericTag<LoggerService>("LoggerService");

export function createLoggerLayer(): Layer.Layer<LoggerService, never, ConfigService> {
  return Layer.succeed(LoggerServiceTag, new LoggerServiceImpl());
}

// Helper functions for common logging patterns
export function logAgentOperation(
  agentId: string,
  operation: string,
  meta?: Record<string, unknown>,
): Effect.Effect<void, never, LoggerService | ConfigService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerServiceTag;
    yield* logger.info(`Agent ${agentId}: ${operation}`, {
      agentId,
      operation,
      ...meta,
    });
  });
}

export function logTaskExecution(
  taskId: string,
  status: "started" | "completed" | "failed",
  meta?: Record<string, unknown>,
): Effect.Effect<void, never, LoggerService | ConfigService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerServiceTag;
    yield* logger.info(`Task ${taskId}: ${status}`, {
      taskId,
      status,
      ...meta,
    });
  });
}

export function logAutomationEvent(
  automationId: string,
  event: string,
  meta?: Record<string, unknown>,
): Effect.Effect<void, never, LoggerService | ConfigService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerServiceTag;
    yield* logger.info(`Automation ${automationId}: ${event}`, {
      automationId,
      event,
      ...meta,
    });
  });
}

// Tool execution logging helpers
export function logToolExecutionStart(
  toolName: string,
  agentId: string,
  conversationId?: string,
): Effect.Effect<void, never, LoggerService | ConfigService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerServiceTag;
    const toolEmoji = getToolEmoji(toolName);
    yield* logger.info(`${toolEmoji} ${toolName}`, {
      toolName,
      agentId,
      conversationId,
      status: "started",
    });
  });
}

export function logToolExecutionSuccess(
  toolName: string,
  agentId: string,
  durationMs: number,
  conversationId?: string,
  resultSummary?: string,
): Effect.Effect<void, never, LoggerService | ConfigService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerServiceTag;
    const toolEmoji = getToolEmoji(toolName);
    const duration = formatDuration(durationMs);
    const message = resultSummary
      ? `${toolEmoji} ${toolName} ✅ (${duration}) - ${resultSummary}`
      : `${toolEmoji} ${toolName} ✅ (${duration})`;

    yield* logger.info(message, {
      toolName,
      agentId,
      conversationId,
      durationMs,
      status: "success",
    });
  });
}

export function logToolExecutionError(
  toolName: string,
  agentId: string,
  durationMs: number,
  error: string,
  conversationId?: string,
): Effect.Effect<void, never, LoggerService | ConfigService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerServiceTag;
    const toolEmoji = getToolEmoji(toolName);
    const duration = formatDuration(durationMs);
    const message = `${toolEmoji} ${toolName} ✗ (${duration}) - ${error}`;

    yield* logger.error(message, {
      toolName,
      agentId,
      conversationId,
      durationMs,
      status: "error",
      error,
    });
  });
}

export function logToolExecutionApproval(
  toolName: string,
  agentId: string,
  durationMs: number,
  approvalMessage: string,
  conversationId?: string,
): Effect.Effect<void, never, LoggerService | ConfigService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerServiceTag;
    const toolEmoji = getToolEmoji(toolName);
    const duration = formatDuration(durationMs);
    const message = `${toolEmoji} ${toolName} ⚠️ APPROVE REQUIRED (${duration}) - ${approvalMessage}`;

    yield* logger.warn(message, {
      toolName,
      agentId,
      conversationId,
      durationMs,
      status: "approval_required",
      approvalMessage,
    });
  });
}

// Utility functions for tool logging
function getToolEmoji(toolName: string): string {
  const toolEmojis: Record<string, string> = {
    // Gmail tools
    listEmails: "📧",
    getEmail: "📨",
    sendEmail: "📤",
    replyToEmail: "↩️",
    forwardEmail: "↗️",
    markAsRead: "👁️",
    markAsUnread: "👁️‍🗨️",
    deleteEmail: "🗑️",
    createLabel: "🏷️",
    addLabel: "🏷️",
    removeLabel: "🏷️",
    searchEmails: "🔍",
    // Default
    default: "🔧",
  };

  const emoji = toolEmojis[toolName];
  if (emoji !== undefined) {
    return emoji;
  }
  return "🔧"; // Default emoji
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

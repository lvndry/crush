import { Context, Effect, Layer } from "effect";
import type { AppConfig } from "../core/types/index";

/**
 * Structured logging service using Effect's Logger
 */

export interface LoggerService {
  readonly debug: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void>;
  readonly info: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void>;
  readonly warn: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void>;
  readonly error: (message: string, meta?: Record<string, unknown>) => Effect.Effect<void>;
}

export class LoggerServiceImpl implements LoggerService {
  constructor(_config: AppConfig) {
    // Config is available for future use
    void _config;
  }

  debug(message: string, meta?: Record<string, unknown>): Effect.Effect<void> {
    return Effect.logDebug(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): Effect.Effect<void> {
    return Effect.logInfo(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): Effect.Effect<void> {
    return Effect.logWarning(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): Effect.Effect<void> {
    return Effect.logError(message, meta);
  }
}

export const LoggerServiceTag = Context.GenericTag<LoggerService>("LoggerService");

export function createLoggerLayer(config: AppConfig): Layer.Layer<LoggerService> {
  return Layer.succeed(LoggerServiceTag, new LoggerServiceImpl(config));
}

// Removed createLoggerLayerFromConfig due to Config API complexity

// Helper functions for common logging patterns
export function logAgentOperation(
  agentId: string,
  operation: string,
  meta?: Record<string, unknown>
): Effect.Effect<void, never, LoggerService> {
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
  meta?: Record<string, unknown>
): Effect.Effect<void, never, LoggerService> {
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
  meta?: Record<string, unknown>
): Effect.Effect<void, never, LoggerService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerServiceTag;
    yield* logger.info(`Automation ${automationId}: ${event}`, {
      automationId,
      event,
      ...meta,
    });
  });
}

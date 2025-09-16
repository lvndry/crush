import { Context, Effect, Layer } from "effect";
import { type ToolDefinition } from "../../../services/llm/types";
import {
    type LoggerService,
    logToolExecutionApproval,
    logToolExecutionError,
    logToolExecutionStart,
    logToolExecutionSuccess,
} from "../../../services/logger";

/**
 * Tool registry for managing agent tools
 */

export interface ToolExecutionContext {
  readonly agentId: string;
  readonly conversationId?: string;
  readonly userId?: string;
  readonly [key: string]: unknown;
}

export interface ToolExecutionResult {
  readonly success: boolean;
  readonly result: unknown;
  readonly error?: string;
}

export interface Tool<R = never> {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  /** If true, this tool is hidden from UI listings (but still usable programmatically). */
  readonly hidden: boolean;
  readonly execute: (
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ) => Effect.Effect<ToolExecutionResult, Error, R>;
}

export interface ToolRegistry {
  readonly registerTool: (tool: Tool<unknown>) => Effect.Effect<void, never>;
  readonly getTool: (name: string) => Effect.Effect<Tool<unknown>, Error>;
  readonly listTools: () => Effect.Effect<readonly string[], never>;
  readonly getToolDefinitions: () => Effect.Effect<readonly ToolDefinition[], never>;
  readonly executeTool: (
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ) => Effect.Effect<ToolExecutionResult, Error, ToolRegistry | LoggerService>;
}

class DefaultToolRegistry implements ToolRegistry {
  private tools: Map<string, Tool<unknown>>;

  constructor() {
    this.tools = new Map<string, Tool<unknown>>();
  }

  registerTool(tool: Tool<unknown>): Effect.Effect<void, never> {
    return Effect.sync(() => {
      this.tools.set(tool.name, tool);
    });
  }

  getTool(name: string): Effect.Effect<Tool<unknown>, Error> {
    return Effect.try({
      try: () => {
        const tool = this.tools.get(name);
        if (!tool) {
          throw new Error(`Tool not found: ${name}`);
        }
        return tool;
      },
      catch: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    });
  }

  listTools(): Effect.Effect<readonly string[], never> {
    return Effect.sync(() => {
      const names: string[] = [];
      this.tools.forEach((tool) => {
        if (!tool.hidden) names.push(tool.name);
      });
      return names;
    });
  }

  getToolDefinitions(): Effect.Effect<readonly ToolDefinition[], never> {
    return Effect.sync(() => {
      const definitions: ToolDefinition[] = [];

      this.tools.forEach((tool) => {
        definitions.push({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        });
      });

      return definitions;
    });
  }

  executeTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Effect.Effect<ToolExecutionResult, Error, ToolRegistry | LoggerService> {
    return Effect.gen(
      function* (this: DefaultToolRegistry) {
        const start = Date.now();
        const tool = yield* this.getTool(name);

        // Log tool execution start
        yield* logToolExecutionStart(name, context.agentId, context.conversationId).pipe(
          Effect.catchAll(() => Effect.void),
        );

        try {
          const exec = tool.execute as (
            a: Record<string, unknown>,
            c: ToolExecutionContext,
          ) => Effect.Effect<ToolExecutionResult, Error, never>;
          const result = yield* exec(args, context);
          const durationMs = Date.now() - start;

          if (result.success) {
            // Create a summary of the result for better logging
            const resultSummary = createResultSummary(name, result);

            // Log successful execution with improved formatting
            yield* logToolExecutionSuccess(
              name,
              context.agentId,
              durationMs,
              context.conversationId,
              resultSummary,
            ).pipe(Effect.catchAll(() => Effect.void));
          } else {
            // If this is an approval-required response, log as warning with special label
            const resultObj = result.result as
              | { approvalRequired?: boolean; message?: string }
              | undefined;
            const isApproval = resultObj?.approvalRequired === true;
            if (isApproval) {
              const approvalMsg = resultObj?.message || result.error || "Approval required";
              yield* logToolExecutionApproval(
                name,
                context.agentId,
                durationMs,
                approvalMsg,
                context.conversationId,
              ).pipe(Effect.catchAll(() => Effect.void));
            } else {
              const errorMessage = result.error || "Tool returned success=false";
              yield* logToolExecutionError(
                name,
                context.agentId,
                durationMs,
                errorMessage,
                context.conversationId,
              ).pipe(Effect.catchAll(() => Effect.void));
            }
          }

          return result;
        } catch (err) {
          const durationMs = Date.now() - start;
          const errorMessage = err instanceof Error ? err.message : String(err);

          // Log error with improved formatting
          yield* logToolExecutionError(
            name,
            context.agentId,
            durationMs,
            errorMessage,
            context.conversationId,
          ).pipe(Effect.catchAll(() => Effect.void));

          throw err as Error;
        }
      }.bind(this),
    );
  }
}

// Helper function to create meaningful result summaries
function createResultSummary(toolName: string, result: ToolExecutionResult): string | undefined {
  if (!result.success) {
    return undefined;
  }

  const data = result.result;

  switch (toolName) {
    case "listEmails":
      if (Array.isArray(data)) {
        return `Found ${data.length} emails`;
      }
      break;

    case "getEmail":
      if (data && typeof data === "object" && "subject" in data) {
        return `Retrieved: ${(data as unknown as { subject: string }).subject}`;
      }
      break;

    case "sendEmail":
      if (data && typeof data === "object" && "messageId" in data) {
        return `Sent successfully (ID: ${(data as unknown as { messageId: string }).messageId})`;
      }
      break;

    case "replyToEmail":
    case "forwardEmail":
      if (data && typeof data === "object" && "messageId" in data) {
        return `Message sent (ID: ${(data as unknown as { messageId: string }).messageId})`;
      }
      break;

    case "markAsRead":
    case "markAsUnread":
      return "Status updated";

    case "trashEmail":
      return "Email moved to trash";

    case "deleteEmail":
      return "Email deleted permanently";

    case "createLabel":
      if (data && typeof data === "object" && "id" in data) {
        return `Label created (ID: ${(data as unknown as { id: string }).id})`;
      }
      break;

    case "addLabel":
    case "removeLabel":
      return "Labels updated";

    case "searchEmails":
      if (Array.isArray(data)) {
        return `Found ${data.length} matching emails`;
      }
      break;

    default:
      return undefined;
  }

  return undefined;
}

// Create a service tag for dependency injection
export const ToolRegistryTag = Context.GenericTag<ToolRegistry>("ToolRegistry");

// Create a layer for providing the tool registry
export function createToolRegistryLayer(): Layer.Layer<ToolRegistry> {
  return Layer.succeed(ToolRegistryTag, new DefaultToolRegistry());
}

// Helper functions for common tool registry operations
export function registerTool(tool: Tool<unknown>): Effect.Effect<void, never, ToolRegistry> {
  return Effect.gen(function* () {
    const registry = yield* ToolRegistryTag;
    return yield* registry.registerTool(tool);
  });
}

/**
 * Execute a tool by name with the provided arguments
 *
 * Finds the specified tool in the registry and executes it with the given arguments
 * and context. Provides comprehensive logging of the execution process including
 * start, success, and error states.
 *
 * @param name - The name of the tool to execute
 * @param args - The arguments to pass to the tool
 * @param context - The execution context containing agent and conversation information
 * @returns An Effect that resolves to the tool execution result
 *
 * @throws {Error} When the tool is not found or execution fails
 *
 * @example
 * ```typescript
 * const result = yield* executeTool(
 *   "gmail_list_emails",
 *   { query: "is:unread" },
 *   { agentId: "agent-123", conversationId: "conv-456" }
 * );
 * ```
 */
export function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Effect.Effect<ToolExecutionResult, Error, ToolRegistry | LoggerService> {
  return Effect.gen(function* () {
    const registry = yield* ToolRegistryTag;
    return yield* registry.executeTool(name, args, context);
  });
}

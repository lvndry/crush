import { Context, Effect, Layer } from "effect";
import { type ToolDefinition } from "../../../services/llm/types";

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
  readonly execute: (
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Effect.Effect<ToolExecutionResult, Error, R>;
}

export interface ToolRegistry {
  readonly registerTool: (tool: Tool<any>) => Effect.Effect<void, never>;
  readonly getTool: (name: string) => Effect.Effect<Tool<any>, Error>;
  readonly listTools: () => Effect.Effect<readonly string[], never>;
  readonly getToolDefinitions: () => Effect.Effect<readonly ToolDefinition[], never>;
  readonly executeTool: (
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Effect.Effect<ToolExecutionResult, Error, ToolRegistry | any>;
}

class DefaultToolRegistry implements ToolRegistry {
  private tools: Map<string, Tool<any>>;

  constructor() {
    this.tools = new Map<string, Tool<any>>();
  }

  registerTool(tool: Tool<any>): Effect.Effect<void, never> {
    return Effect.sync(() => {
      this.tools.set(tool.name, tool);
    });
  }

  getTool(name: string): Effect.Effect<Tool<any>, Error> {
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
    return Effect.sync(() => Array.from(this.tools.keys()));
  }

  getToolDefinitions(): Effect.Effect<readonly ToolDefinition[], never> {
    return Effect.sync(() => {
      const definitions: ToolDefinition[] = [];

      this.tools.forEach(tool => {
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
    context: ToolExecutionContext
  ): Effect.Effect<ToolExecutionResult, Error, ToolRegistry | any> {
    return this.getTool(name).pipe(
      Effect.flatMap(tool =>
        (
          tool.execute as (
            a: Record<string, unknown>,
            c: ToolExecutionContext
          ) => Effect.Effect<ToolExecutionResult, Error, any>
        )(args, context)
      )
    );
  }
}

// Create a service tag for dependency injection
export const ToolRegistryTag = Context.GenericTag<ToolRegistry>("ToolRegistry");

// Create a layer for providing the tool registry
export function createToolRegistryLayer(): Layer.Layer<ToolRegistry> {
  return Layer.succeed(ToolRegistryTag, new DefaultToolRegistry());
}

// Helper functions for common tool registry operations
export function registerTool(tool: Tool<any>): Effect.Effect<void, never, ToolRegistry> {
  return Effect.gen(function* () {
    const registry = yield* ToolRegistryTag;
    return yield* registry.registerTool(tool);
  });
}

export function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Effect.Effect<ToolExecutionResult, Error, ToolRegistry | any> {
  return Effect.gen(function* () {
    const registry = yield* ToolRegistryTag;
    return yield* registry.executeTool(name, args, context);
  });
}

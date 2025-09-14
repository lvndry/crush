import { Effect } from "effect";
import { type Tool, type ToolExecutionContext, type ToolExecutionResult } from "./tool-registry";

/**
 * Lightweight, reusable tool builder with optional runtime validation.
 * Keeps JSON Schema as-is for LLMs and applies a simple validator at runtime.
 */

export interface ToolValidatorResult<Args extends Record<string, unknown>> {
  readonly valid: boolean;
  readonly value?: Args;
  readonly errors?: readonly string[];
}

export type ToolValidator<Args extends Record<string, unknown>> = (
  args: Record<string, unknown>,
) => ToolValidatorResult<Args>;

export interface BaseToolConfig<R, Args extends Record<string, unknown>> {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly validate?: ToolValidator<Args>;
  readonly handler: (
    args: Args,
    context: ToolExecutionContext,
  ) => Effect.Effect<ToolExecutionResult, Error, R>;
}

export function defineTool<R, Args extends Record<string, unknown>>(
  config: BaseToolConfig<R, Args>,
): Tool<R> {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    execute(
      args: Record<string, unknown>,
      context: ToolExecutionContext,
    ): Effect.Effect<ToolExecutionResult, Error, R> {
      if (config.validate) {
        const result = config.validate(args);
        if (!result.valid) {
          const message = (result.errors || ["Invalid arguments"]).join("; ");
          return Effect.succeed({ success: false, result: null, error: message });
        }
        return config.handler(result.value as Args, context);
      }
      // No validation configured; pass through
      return config.handler(args as Args, context);
    },
  };
}

/**
 * Build a minimal runtime validator from a JSON Schema subset.
 * Supports: type = string|number|boolean|array(object: items.type), required[], additionalProperties.
 */
export function makeJsonSchemaValidator<Args extends Record<string, unknown>>(
  schema: Record<string, unknown>,
): ToolValidator<Args> {
  return (args: Record<string, unknown>) => {
    const errors: string[] = [];

    const s = schema as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: readonly string[];
      additionalProperties?: boolean;
    };

    if (s.type !== undefined && s.type !== "object") {
      errors.push("Root schema.type must be 'object'");
    }

    const properties = (s.properties || {}) as Record<
      string,
      { type?: string; items?: { type?: string } }
    >;
    const required = new Set((s.required || []) as string[]);

    for (const key of required) {
      if (!(key in args)) {
        errors.push(`Missing required property: ${key}`);
      }
    }

    for (const [key, value] of Object.entries(args)) {
      const prop = properties[key];
      if (!prop) {
        if (s.additionalProperties === false) {
          errors.push(`Unknown property: ${key}`);
        }
        continue;
      }
      const expected = prop.type;
      if (!expected) continue;
      const actual = typeof value;
      if (expected === "array") {
        if (!Array.isArray(value)) {
          errors.push(`Property '${key}' expected array, got ${actual}`);
        } else {
          const itemType = prop.items?.type;
          if (itemType) {
            for (let i = 0; i < value.length; i++) {
              const t = typeof (value as unknown[])[i];
              if (t !== itemType) {
                errors.push(`Property '${key}[${i}]' expected ${itemType}, got ${t}`);
              }
            }
          }
        }
      } else if (actual !== expected) {
        errors.push(`Property '${key}' expected ${expected}, got ${actual}`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors } as const;
    }

    return { valid: true, value: args as Args } as const;
  };
}

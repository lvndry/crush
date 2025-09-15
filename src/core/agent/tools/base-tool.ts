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
  /** If true, hide this tool from UI listings while keeping it callable. */
  readonly hidden?: boolean;
  readonly validate?: ToolValidator<Args>;
  /**
   * Optional approval requirement for destructive tools.
   * If provided, the tool will ALWAYS show the approval message and require user confirmation.
   * The LLM cannot bypass this by setting any field - it must ask the user for confirmation.
   */
  readonly approval?: {
    /**
     * Create a human-readable message explaining what will happen.
     * Used to guide the agent to ask the user for confirmation.
     * Can be async to fetch additional context (like email details).
     */
    readonly message: (
      args: Args,
      context: ToolExecutionContext,
    ) => Effect.Effect<string, Error, R>;
    /**
     * Optional execution callback that defines which tool to call on user approval
     * and how to build its arguments from the validated input.
     */
    readonly execute?: {
      readonly toolName: string;
      readonly buildArgs: (args: Args) => Record<string, unknown>;
    };
  };
  readonly handler: (
    args: Args,
    context: ToolExecutionContext,
  ) => Effect.Effect<ToolExecutionResult, Error, R>;
}

/**
 * Define a new tool with validation and approval capabilities
 *
 * Creates a tool from the provided configuration, including optional validation
 * and approval requirements. The tool can be configured to require user approval
 * for destructive operations and includes comprehensive argument validation.
 *
 * @param config - The tool configuration including name, description, parameters, validation, and approval settings
 * @returns A Tool object that can be registered and executed
 *
 * @example
 * ```typescript
 * const emailTool = defineTool({
 *   name: "send_email",
 *   description: "Send an email to a recipient",
 *   parameters: {
 *     to: { type: "string", description: "Recipient email address" },
 *     subject: { type: "string", description: "Email subject" }
 *   },
 *   handler: async (args, context) => {
 *     // Tool implementation
 *     return { success: true, result: "Email sent" };
 *   }
 * });
 * ```
 */
export function defineTool<R, Args extends Record<string, unknown>>(
  config: BaseToolConfig<R, Args>,
): Tool<R> {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    hidden: config.hidden === true,
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
        const validated = result.value as Args;
        // Enforce approval if configured - ALWAYS require approval for destructive tools
        if (config.approval) {
          // Generate approval message (can be async to fetch context)
          return Effect.gen(function* () {
            const approvalMessage = yield* config.approval!.message(validated, context);
            const execute = config.approval?.execute;
            return {
              success: false,
              result: {
                approvalRequired: true,
                message: approvalMessage,
                ...(execute
                  ? {
                      instruction: `Please ask the user for confirmation. If they confirm, call: ${execute.toolName}`,
                      executeToolName: execute.toolName,
                      executeArgs: execute.buildArgs(validated),
                    }
                  : {}),
              },
              error:
                "Approval required: This is a destructive action that requires user confirmation.",
            } as ToolExecutionResult;
          });
        }
        return config.handler(validated, context);
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

/**
 * Utility to extend a JSON schema object with a standard approval boolean field.
 * This does not mutate the original schema object.
 */
export function withApprovalBoolean(
  schema: Record<string, unknown>,
  options?: { fieldName?: string; description?: string },
): Record<string, unknown> {
  const fieldName = options?.fieldName ?? "confirm";
  const description =
    options?.description ??
    "Set to true to confirm this destructive action. The operation cannot be undone.";

  const copy = JSON.parse(JSON.stringify(schema)) as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  if (!copy.properties) copy.properties = {};
  copy.properties[fieldName] = { type: "boolean", description };
  // Do not force it required by default; approval logic enforces it at runtime.
  return copy as unknown as Record<string, unknown>;
}

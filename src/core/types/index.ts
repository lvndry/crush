import { Schema } from "effect";

/**
 * Core types and interfaces for the Crush automation CLI
 */

export type { ChatMessage } from "../../services/llm/types";

// Agent Types
export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly config: AgentConfig;
  readonly status: AgentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AgentConfig {
  readonly tasks: readonly Task[];
  readonly schedule?: Schedule;
  retryPolicy?: RetryPolicy;
  timeout?: number;
  readonly environment?: Record<string, string>;
  readonly agentType: string;
  readonly llmProvider: string;
  readonly llmModel: string;
  readonly tools?: readonly string[];
}

export type AgentStatus = "idle" | "running" | "paused" | "error" | "completed";

// Task Types
export interface Task {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: TaskType;
  readonly config: TaskConfig;
  readonly dependencies?: readonly string[];
  readonly retryCount?: number;
  readonly maxRetries?: number;
}

export type TaskType = "command" | "script" | "api" | "file" | "webhook" | "custom" | "gmail";

export type GmailOperation = "listEmails" | "getEmail" | "sendEmail" | "searchEmails";

export interface TaskConfig {
  readonly command?: string;
  readonly script?: string;
  readonly url?: string;
  readonly method?: "GET" | "POST" | "PUT" | "DELETE";
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly filePath?: string;
  readonly workingDirectory?: string;
  readonly environment?: Record<string, string>;
  readonly gmailOperation?: GmailOperation;
  readonly gmailQuery?: string;
  readonly gmailMaxResults?: number;
  readonly emailId?: string;
  readonly to?: string[];
  readonly subject?: string;
  readonly cc?: string[];
  readonly bcc?: string[];
}

// Automation Types
export interface Automation {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly agents: readonly string[];
  readonly triggers: readonly Trigger[];
  readonly status: AutomationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type AutomationStatus = "active" | "inactive" | "paused" | "error";

export interface Trigger {
  readonly id: string;
  readonly type: TriggerType;
  readonly config: TriggerConfig;
  readonly enabled: boolean;
}

export type TriggerType = "schedule" | "file" | "webhook" | "manual" | "event";

export interface TriggerConfig {
  readonly cron?: string;
  readonly interval?: number;
  readonly filePath?: string;
  readonly event?: string;
  readonly conditions?: readonly Condition[];
}

export interface Condition {
  readonly field: string;
  readonly operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than";
  readonly value: unknown;
}

// Schedule Types
export interface Schedule {
  readonly type: "cron" | "interval" | "once";
  readonly value: string | number;
  readonly timezone?: string;
  readonly enabled: boolean;
}

// Retry Policy
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoff: "linear" | "exponential" | "fixed";
  readonly delay: number;
  readonly maxDelay?: number;
}

// Result Types
export interface TaskResult {
  readonly taskId: string;
  readonly status: "success" | "failure" | "skipped";
  readonly output?: string;
  readonly error?: string;
  readonly duration: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface AgentResult {
  readonly agentId: string;
  readonly status: "success" | "failure" | "partial";
  readonly taskResults: readonly TaskResult[];
  readonly duration: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

// Configuration Types
export interface AppConfig {
  readonly storage: StorageConfig;
  readonly logging: LoggingConfig;
  readonly security: SecurityConfig;
  readonly performance: PerformanceConfig;
  readonly google?: GoogleConfig;
  readonly llm?: LLMConfig;
  readonly linkup?: LinkupConfig;
}

export type StorageConfig =
  | {
      readonly type: "file";
      readonly path: string;
    }
  | {
      readonly type: "database";
      readonly connectionString: string;
    };

export interface LoggingConfig {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly format: "json" | "pretty";
  readonly output: "console" | "file" | "both";
  readonly filePath?: string;
}

export interface SecurityConfig {
  readonly encryptionKey?: string;
  readonly allowedOrigins?: readonly string[];
  readonly rateLimit?: RateLimitConfig;
}

export interface RateLimitConfig {
  readonly requests: number;
  readonly window: number;
}

export interface PerformanceConfig {
  readonly maxConcurrentAgents: number;
  readonly maxConcurrentTasks: number;
  readonly timeout: number;
  readonly memoryLimit?: number;
}

export interface GoogleConfig {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface LLMProviderConfig {
  readonly api_key: string;
}

export interface LLMConfig {
  readonly defaultProvider?: string;
  readonly openai?: LLMProviderConfig;
  readonly anthropic?: LLMProviderConfig;
  readonly google?: LLMProviderConfig;
  readonly mistral?: LLMProviderConfig;
  readonly contextManagement?: ContextManagementConfig;
}

export interface ContextManagementConfig {
  readonly summarizationThreshold?: number; // Percentage of context window (0.0-1.0)
  readonly targetTokensRatio?: number; // Target tokens as ratio of max context (0.0-1.0)
  readonly aggressiveThreshold?: number; // Aggressive summarization threshold (0.0-1.0)
  readonly preserveRecentMessages?: number; // Number of recent messages to always keep
  readonly maxRecentTokens?: number; // Maximum tokens to preserve in recent messages
  readonly enableProactiveSummarization?: boolean; // Whether to summarize proactively
  readonly summarizeToolResults?: boolean; // Whether to summarize large tool call results
}

export interface LinkupConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeout?: number;
}

// Schema definitions for runtime validation
export const AgentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  config: Schema.Struct({
    tasks: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        description: Schema.String,
        type: Schema.Literal("command", "script", "api", "file", "webhook", "custom", "gmail"),
        config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
        dependencies: Schema.optional(Schema.Array(Schema.String)),
        retryCount: Schema.optional(Schema.Number),
        maxRetries: Schema.optional(Schema.Number),
      }),
    ),
    schedule: Schema.optional(
      Schema.Struct({
        type: Schema.Literal("cron", "interval", "once"),
        value: Schema.Union(Schema.String, Schema.Number),
        timezone: Schema.optional(Schema.String),
        enabled: Schema.Boolean,
      }),
    ),
    retryPolicy: Schema.optional(
      Schema.Struct({
        maxRetries: Schema.Number,
        backoff: Schema.Literal("linear", "exponential", "fixed"),
        delay: Schema.Number,
        maxDelay: Schema.optional(Schema.Number),
      }),
    ),
    timeout: Schema.optional(Schema.Number),
    environment: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
    // LLM agent fields
    agentType: Schema.optional(Schema.String),
    llmProvider: Schema.optional(Schema.String),
    llmModel: Schema.optional(Schema.String),
    tools: Schema.optional(Schema.Array(Schema.String)),
  }),
  status: Schema.Literal("idle", "running", "paused", "error", "completed"),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const TaskSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  type: Schema.Literal("command", "script", "api", "file", "webhook", "custom", "gmail"),
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  dependencies: Schema.optional(Schema.Array(Schema.String)),
  retryCount: Schema.optional(Schema.Number),
  maxRetries: Schema.optional(Schema.Number),
});

export const AutomationSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  agents: Schema.Array(Schema.String),
  triggers: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      type: Schema.Literal("schedule", "file", "webhook", "manual", "event"),
      config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      enabled: Schema.Boolean,
    }),
  ),
  status: Schema.Literal("active", "inactive", "paused", "error"),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

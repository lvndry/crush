import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer, Option } from "effect";
import type {
  AppConfig,
  GoogleConfig,
  LLMConfig,
  LoggingConfig,
  PerformanceConfig,
  SecurityConfig,
  StorageConfig,
} from "../core/types/index";

/**
 * Configuration service using Effect's Config module
 */

export interface ConfigService {
  readonly get: <A>(key: string) => Effect.Effect<A, never>;
  readonly getOrElse: <A>(key: string, fallback: A) => Effect.Effect<A, never>;
  readonly getOrFail: <A>(key: string) => Effect.Effect<A, never>;
  readonly has: (key: string) => Effect.Effect<boolean, never>;
  readonly set: <A>(key: string, value: A) => Effect.Effect<void, never>;
  readonly appConfig: Effect.Effect<AppConfig, never>;
}

export class ConfigServiceImpl implements ConfigService {
  private currentConfig: AppConfig;
  constructor(initialConfig: AppConfig) {
    this.currentConfig = initialConfig;
  }

  get<A>(key: string): Effect.Effect<A, never> {
    return Effect.sync(
      () => deepGet(this.currentConfig as unknown as Record<string, unknown>, key) as A,
    );
  }

  getOrElse<A>(key: string, fallback: A): Effect.Effect<A, never> {
    return Effect.sync(() => {
      const value = deepGet(this.currentConfig as unknown as Record<string, unknown>, key);
      return value === undefined || value === null ? fallback : (value as A);
    });
  }

  getOrFail<A>(key: string): Effect.Effect<A, never> {
    return Effect.sync(
      () => deepGet(this.currentConfig as unknown as Record<string, unknown>, key) as A,
    );
  }

  has(key: string): Effect.Effect<boolean, never> {
    return Effect.sync(() =>
      deepHas(this.currentConfig as unknown as Record<string, unknown>, key),
    );
  }

  set<A>(key: string, value: A): Effect.Effect<void, never> {
    return Effect.sync(() => {
      deepSet(this.currentConfig as unknown as Record<string, unknown>, key, value as unknown);
    });
  }

  get appConfig(): Effect.Effect<AppConfig, never> {
    return Effect.succeed(this.currentConfig);
  }
}

export const AgentConfigService = Context.GenericTag<ConfigService>("ConfigService");

export function createConfigLayer(): Layer.Layer<ConfigService, never, FileSystem.FileSystem> {
  return Layer.effect(
    AgentConfigService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const loaded = yield* loadConfigFile(fs);
      const config = mergeConfig(defaultConfig(), loaded.fileConfig ?? undefined);
      return new ConfigServiceImpl(config);
    }),
  );
}

export function getConfigValue<T>(
  key: string,
  defaultValue: T,
): Effect.Effect<T, never, ConfigService> {
  return Effect.gen(function* () {
    const config = yield* AgentConfigService;
    const result = yield* config.getOrElse(key, defaultValue);
    return result;
  });
}

export function requireConfigValue<T>(key: string): Effect.Effect<T, never, ConfigService> {
  return Effect.gen(function* () {
    const config = yield* AgentConfigService;
    const result = yield* config.getOrFail(key);
    return result as T;
  });
}

// -----------------
// Internal helpers
// -----------------

function defaultConfig(): AppConfig {
  const storage: StorageConfig = { type: "file", path: "./.crush" };
  const logging: LoggingConfig = { level: "info", format: "pretty", output: "console" };
  const security: SecurityConfig = {};
  const performance: PerformanceConfig = {
    maxConcurrentAgents: 5,
    maxConcurrentTasks: 10,
    timeout: 30000,
  };
  const google: GoogleConfig = {};
  const llm: LLMConfig = {
    contextManagement: {
      summarizationThreshold: 0.75, // Summarize when 75% of context window is used
      targetTokensRatio: 0.6, // Target 60% of context window after summarization
      aggressiveThreshold: 0.4, // Use 40% for aggressive summarization on errors
      preserveRecentMessages: 3, // Always keep last 3 messages (conservative for tool-heavy workflows)
      maxRecentTokens: 2000, // Maximum tokens to preserve in recent messages
      enableProactiveSummarization: true, // Enable proactive summarization
      summarizeToolResults: true, // Summarize large tool call results
    },
  };

  return { storage, logging, security, performance, google, llm };
}

function mergeConfig(base: AppConfig, override?: Partial<AppConfig>): AppConfig {
  if (!override) return base;
  return {
    storage: { ...base.storage, ...(override.storage ?? {}) },
    logging: { ...base.logging, ...(override.logging ?? {}) },
    security: { ...base.security, ...(override.security ?? {}) },
    performance: { ...base.performance, ...(override.performance ?? {}) },
    google: { ...(base.google ?? {}), ...(override.google ?? {}) },
    llm: { ...(base.llm ?? {}), ...(override.llm ?? {}) },
  };
}

function expandHome(p: string): string {
  if (p.startsWith("~")) {
    const home = process.env["HOME"] || process.env["USERPROFILE"] || "";
    return home ? p.replace(/^~/, home) : p;
  }
  return p;
}

function loadConfigFile(fs: FileSystem.FileSystem): Effect.Effect<
  {
    configPath?: string;
    fileConfig?: Partial<AppConfig>;
  },
  never
> {
  return Effect.gen(function* () {
    const envConfigPath = process.env["CRUSH_CONFIG_PATH"];
    const candidates: readonly string[] = [
      envConfigPath ? expandHome(envConfigPath) : "",
      `${process.cwd()}/crush.config.json`,
      `${expandHome("~/.crush")}/config.json`,
    ].filter(Boolean);

    for (const path of candidates) {
      const exists = yield* fs.exists(path).pipe(Effect.catchAll(() => Effect.succeed(false)));
      if (!exists) continue;
      const content = yield* fs
        .readFileString(path)
        .pipe(Effect.catchAll(() => Effect.succeed("")));
      if (!content) return { configPath: path };
      const parsed = safeParseJson<Partial<AppConfig>>(content);
      if (Option.isSome(parsed)) {
        return { configPath: path, fileConfig: parsed.value };
      }
      // If parse failed, ignore and continue to next
    }

    return {};
  });
}

function safeParseJson<T>(text: string): Option.Option<T> {
  try {
    return Option.some(JSON.parse(text) as T);
  } catch {
    return Option.none();
  }
}

/**
 * Deep object property access using dot notation paths.
 *
 * The 'path' parameter uses dot notation to navigate nested objects:
 * - "name" -> obj.name
 * - "storage.type" -> obj.storage.type
 * - "logging.level" -> obj.logging.level
 *
 * This allows flexible access to both simple and deeply nested properties
 * using the same interface, commonly used in configuration management.
 */
function deepGet(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Checks if a property exists at the given dot notation path.
 * Uses deepGet internally to determine existence.
 */
function deepHas(obj: Record<string, unknown>, path: string): boolean {
  return deepGet(obj, path) !== undefined;
}

/**
 * Sets a value at the given dot notation path, creating intermediate objects as needed.
 *
 * Example: deepSet(obj, "storage.type", "file") sets obj.storage.type = "file"
 * If obj.storage doesn't exist, it will be created as an empty object first.
 */
function deepSet(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i] as string;
    if (i === parts.length - 1) {
      cur[key] = value;
    } else {
      const next = cur[key];
      if (!next || typeof next !== "object") {
        cur[key] = {} as unknown;
      }
      cur = cur[key] as Record<string, unknown>;
    }
  }
}

import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer, Option } from "effect";
import type {
  AppConfig,
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
      const config = applyEnvOverrides(
        mergeConfig(defaultConfig(), loaded.fileConfig ?? undefined),
      );
      return new ConfigServiceImpl(config);
    }),
  );
}

// Helper functions for common configuration operations
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
  const storage: StorageConfig = { type: "file", path: "./data" };
  const logging: LoggingConfig = { level: "info", format: "pretty", output: "console" };
  const security: SecurityConfig = {};
  const performance: PerformanceConfig = {
    maxConcurrentAgents: 5,
    maxConcurrentTasks: 10,
    timeout: 30000,
  };
  return { storage, logging, security, performance };
}

function mergeConfig(base: AppConfig, override?: Partial<AppConfig>): AppConfig {
  if (!override) return base;
  return {
    storage: { ...base.storage, ...(override.storage ?? {}) },
    logging: { ...base.logging, ...(override.logging ?? {}) },
    security: { ...base.security, ...(override.security ?? {}) },
    performance: { ...base.performance, ...(override.performance ?? {}) },
  };
}

function applyEnvOverrides(cfg: AppConfig): AppConfig {
  const parseNumber = (v: string | undefined): number | undefined =>
    v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined;

  const env = process.env;

  // Storage
  const envStorageType = env["CRUSH_STORAGE_TYPE"];
  const storageType: StorageConfig["type"] =
    envStorageType === "file" || envStorageType === "database" ? envStorageType : cfg.storage.type;
  const envStoragePath = env["CRUSH_STORAGE_PATH"];
  const envStorageConn = env["CRUSH_STORAGE_CONNECTION_STRING"];
  const storage: StorageConfig = {
    type: storageType,
    ...(envStoragePath
      ? { path: envStoragePath }
      : cfg.storage.path
        ? { path: cfg.storage.path }
        : {}),
    ...(envStorageConn
      ? { connectionString: envStorageConn }
      : cfg.storage.connectionString
        ? { connectionString: cfg.storage.connectionString }
        : {}),
  };

  // Logging
  const envLevel = env["CRUSH_LOG_LEVEL"];
  const level: LoggingConfig["level"] =
    envLevel === "debug" || envLevel === "info" || envLevel === "warn" || envLevel === "error"
      ? envLevel
      : cfg.logging.level;
  const envFormat = env["CRUSH_LOG_FORMAT"];
  const format: LoggingConfig["format"] =
    envFormat === "json" || envFormat === "pretty" ? envFormat : cfg.logging.format;
  const envOutput = env["CRUSH_LOG_OUTPUT"];
  const output: LoggingConfig["output"] =
    envOutput === "console" || envOutput === "file" || envOutput === "both"
      ? envOutput
      : cfg.logging.output;
  const envFilePath = env["CRUSH_LOG_FILE_PATH"];
  const logging: LoggingConfig = {
    level,
    format,
    output,
    ...(envFilePath
      ? { filePath: envFilePath }
      : cfg.logging.filePath
        ? { filePath: cfg.logging.filePath }
        : {}),
  };

  // Security
  const envKey = env["CRUSH_ENCRYPTION_KEY"];
  const envOrigins = env["CRUSH_ALLOWED_ORIGINS"];
  // no secBase needed; build object from parts below
  const secRateRequests = parseNumber(env["CRUSH_RATE_LIMIT_REQUESTS"]);
  const secRateWindow = parseNumber(env["CRUSH_RATE_LIMIT_WINDOW"]);
  const secRateLimit =
    secRateRequests !== undefined || secRateWindow !== undefined
      ? {
          rateLimit: {
            requests:
              secRateRequests ?? (cfg.security.rateLimit ? cfg.security.rateLimit.requests : 100),
            window:
              secRateWindow ?? (cfg.security.rateLimit ? cfg.security.rateLimit.window : 60000),
          },
        }
      : cfg.security.rateLimit
        ? { rateLimit: cfg.security.rateLimit }
        : {};
  const security: SecurityConfig = {
    ...(envKey
      ? { encryptionKey: envKey }
      : cfg.security.encryptionKey
        ? { encryptionKey: cfg.security.encryptionKey }
        : {}),
    ...(envOrigins
      ? {
          allowedOrigins: envOrigins
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : cfg.security.allowedOrigins
        ? { allowedOrigins: cfg.security.allowedOrigins }
        : {}),
    ...secRateLimit,
  };

  // Performance
  const mAgents = parseNumber(env["CRUSH_MAX_CONCURRENT_AGENTS"]);
  const mTasks = parseNumber(env["CRUSH_MAX_CONCURRENT_TASKS"]);
  const timeout = parseNumber(env["CRUSH_TIMEOUT"]);
  const mem = parseNumber(env["CRUSH_MEMORY_LIMIT"]);
  const performance: PerformanceConfig = {
    maxConcurrentAgents: mAgents ?? cfg.performance.maxConcurrentAgents,
    maxConcurrentTasks: mTasks ?? cfg.performance.maxConcurrentTasks,
    timeout: timeout ?? cfg.performance.timeout,
    ...(mem !== undefined
      ? { memoryLimit: mem }
      : cfg.performance.memoryLimit !== undefined
        ? { memoryLimit: cfg.performance.memoryLimit }
        : {}),
  };

  return { storage, logging, security, performance };
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
    const fromEnv = process.env["CRUSH_CONFIG"];
    const candidates: readonly string[] = [
      fromEnv ? expandHome(fromEnv) : "",
      `${process.cwd()}/crush.config.json`,
      `${expandHome("~/.crush")}/config.json`,
      "/etc/crush/config.json",
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

function deepHas(obj: Record<string, unknown>, path: string): boolean {
  return deepGet(obj, path) !== undefined;
}

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

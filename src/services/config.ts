import { Context, Effect, Layer } from "effect";
import type { AppConfig } from "../core/types/index";

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
  constructor() {}

  get<A>(key: string): Effect.Effect<A, never> {
    // Simplified implementation for now
    void key; // Suppress unused parameter warning
    return Effect.succeed(undefined as A);
  }

  getOrElse<A>(key: string, fallback: A): Effect.Effect<A, never> {
    void key; // Suppress unused parameter warning
    return Effect.succeed(fallback);
  }

  getOrFail<A>(key: string): Effect.Effect<A, never> {
    void key; // Suppress unused parameter warning
    return Effect.succeed(undefined as A);
  }

  has(key: string): Effect.Effect<boolean, never> {
    void key; // Suppress unused parameter warning
    return Effect.succeed(false);
  }

  set<A>(key: string, value: A): Effect.Effect<void, never> {
    // In a real implementation, this would persist the config
    void key;
    void value; // Suppress unused parameter warnings
    return Effect.succeed(undefined);
  }

  get appConfig(): Effect.Effect<AppConfig, never> {
    return Effect.succeed({
      storage: {
        type: "file",
        path: "./data",
      },
      logging: {
        level: "info",
        format: "pretty",
        output: "console",
      },
      security: {},
      performance: {
        maxConcurrentAgents: 5,
        maxConcurrentTasks: 10,
        timeout: 30000,
      },
    });
  }
}

export const AgentConfigService = Context.GenericTag<ConfigService>("ConfigService");

export function createConfigLayer(): Layer.Layer<ConfigService> {
  return Layer.succeed(AgentConfigService, new ConfigServiceImpl());
}

// Helper functions for common configuration operations
export function getConfigValue<T>(
  key: string,
  defaultValue: T
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

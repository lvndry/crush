import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import {
  AgentAlreadyExistsError,
  AgentNotFoundError,
  ConfigurationError,
  ValidationError,
} from "../types/errors";
import { formatError, handleError } from "./error-handler";

describe("Error Handler", () => {
  it("should format AgentNotFoundError with actionable suggestions", () => {
    const error = new AgentNotFoundError({
      agentId: "non-existent-agent",
      suggestion: "Check if the agent ID is correct or if the agent was deleted",
    });

    const formatted = formatError(error);

    expect(formatted).toContain("❌ Agent Not Found");
    expect(formatted).toContain("No agent found with ID: non-existent-agent");
    expect(formatted).toContain("💡 Suggestion:");
    expect(formatted).toContain("🔧 Recovery Steps:");
    expect(formatted).toContain("jazz agent list");
    expect(formatted).toContain("jazz agent create");
  });

  it("should format AgentAlreadyExistsError with suggestions", () => {
    const error = new AgentAlreadyExistsError({
      agentId: "duplicate-agent",
    });

    const formatted = formatError(error);

    expect(formatted).toContain("❌ Agent Already Exists");
    expect(formatted).toContain('An agent with name "duplicate-agent" already exists');
    expect(formatted).toContain("jazz agent delete");
    expect(formatted).toContain("jazz agent list");
  });

  it("should format ValidationError with field-specific suggestions", () => {
    const error = new ValidationError({
      field: "name",
      message: "Agent name can only contain letters, numbers, underscores, and hyphens",
      value: "invalid@name",
      suggestion:
        "Use only letters (a-z, A-Z), numbers (0-9), underscores (_), and hyphens (-). Example: 'my-agent-1'",
    });

    const formatted = formatError(error);

    expect(formatted).toContain("❌ Validation Error");
    expect(formatted).toContain('Field "name" validation failed');
    expect(formatted).toContain("💡 Suggestion:");
    expect(formatted).toContain("my-agent-1");
  });

  it("should format ConfigurationError with recovery steps", () => {
    const error = new ConfigurationError({
      field: "llm.openai.api_key",
      message: "API key is required",
      value: undefined,
      suggestion: "Set your OpenAI API key in the configuration",
    });

    const formatted = formatError(error);

    expect(formatted).toContain("❌ Configuration Error");
    expect(formatted).toContain('Configuration error in field "llm.openai.api_key"');
    expect(formatted).toContain("🔧 Recovery Steps:");
    expect(formatted).toContain("jazz config list");
    expect(formatted).toContain("jazz config validate");
  });

  it("should handle error display without crashing", async () => {
    const error = new AgentNotFoundError({
      agentId: "test-agent",
    });

    // This should not throw
    await Effect.runPromise(handleError(error));
  });

  it("should provide related commands for different error types", () => {
    const errors = [
      new AgentNotFoundError({ agentId: "test" }),
      new ValidationError({ field: "name", message: "Invalid", value: "test" }),
      new ConfigurationError({ field: "api_key", message: "Missing", value: undefined }),
    ];

    errors.forEach((error) => {
      const formatted = formatError(error);
      expect(formatted).toContain("📚 Related Commands:");
      expect(formatted).toContain("jazz");
    });
  });
});

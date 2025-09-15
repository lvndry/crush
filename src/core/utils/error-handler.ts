import { Effect } from "effect";
import type { CrushError } from "../types/errors";

/**
 * Enhanced error handling utilities with actionable suggestions
 */

export interface ErrorDisplay {
  readonly title: string;
  readonly message: string;
  readonly suggestion?: string;
  readonly recovery?: string[];
  readonly documentation?: string;
  readonly relatedCommands?: string[];
}

/**
 * Generate actionable suggestions for different error types
 *
 * @param error - The error to generate suggestions for
 * @returns An ErrorDisplay object containing title, message, suggestion, recovery steps, and related commands
 * @internal
 */
function generateSuggestions(error: CrushError): ErrorDisplay {
  switch (error._tag) {
    case "AgentNotFoundError": {
      return {
        title: "Agent Not Found",
        message: `No agent found with ID: ${error.agentId}`,
        suggestion:
          error.suggestion || "Check if the agent ID is correct or if the agent was deleted",
        recovery: [
          "List all agents: `crush agent list`",
          "Check agent ID spelling and case sensitivity",
          "Create a new agent: `crush agent create`",
        ],
        relatedCommands: ["crush agent list", "crush agent create"],
      };
    }

    case "AgentAlreadyExistsError": {
      return {
        title: "Agent Already Exists",
        message: `An agent with name "${error.agentId}" already exists`,
        suggestion: error.suggestion || "Choose a different name or delete the existing agent",
        recovery: [
          "Use a different agent name",
          "Delete existing agent: `crush agent delete <agent-id>`",
          "Update existing agent: `crush agent update <agent-id>`",
        ],
        relatedCommands: ["crush agent delete", "crush agent list"],
      };
    }

    case "AgentConfigurationError": {
      return {
        title: "Agent Configuration Error",
        message: `Invalid configuration for agent "${error.agentId}": ${error.message}`,
        suggestion: error.suggestion || `Fix the configuration issue in field: ${error.field}`,
        recovery: [
          `Check the ${error.field} field in your agent configuration`,
          "Validate your configuration: `crush agent validate <agent-id>`",
          "Use the interactive agent editor: `crush agent edit <agent-id>`",
        ],
        relatedCommands: ["crush agent get", "crush agent edit"],
      };
    }

    case "AgentExecutionError": {
      return {
        title: "Agent Execution Failed",
        message: `Agent "${error.agentId}" failed to execute: ${error.reason}`,
        suggestion: error.suggestion || "Check the agent configuration and dependencies",
        recovery: [
          "Check agent configuration: `crush agent get <agent-id>`",
          "Run with verbose logging: `crush agent run <agent-id> --verbose`",
          "Test individual tasks: `crush task test <task-id>`",
        ],
        relatedCommands: ["crush agent get", "crush agent run --verbose"],
      };
    }

    case "TaskNotFoundError": {
      return {
        title: "Task Not Found",
        message: `Task with ID "${error.taskId}" not found`,
        suggestion: error.suggestion || "Check if the task ID is correct",
        recovery: [
          "List all tasks: `crush task list`",
          "Check task ID spelling and case sensitivity",
          "Create a new task: `crush task create`",
        ],
        relatedCommands: ["crush task list", "crush task create"],
      };
    }

    case "TaskExecutionError": {
      return {
        title: "Task Execution Failed",
        message: `Task "${error.taskId}" failed: ${error.reason}`,
        suggestion: error.suggestion || "Check the task configuration and dependencies",
        recovery: [
          "Check task configuration: `crush task get <task-id>`",
          "Run with debug mode: `crush task run <task-id> --debug`",
          "Check task dependencies: `crush task deps <task-id>`",
        ],
        relatedCommands: ["crush task get", "crush task run --debug"],
      };
    }

    case "TaskTimeoutError": {
      return {
        title: "Task Timeout",
        message: `Task "${error.taskId}" timed out after ${error.timeout}ms`,
        suggestion: error.suggestion || "Increase the timeout or optimize the task",
        recovery: [
          "Increase task timeout in configuration",
          "Optimize task performance",
          "Check for resource constraints",
          "Run with longer timeout: `crush task run <task-id> --timeout 60000`",
        ],
        relatedCommands: ["crush task run --timeout", "crush agent config"],
      };
    }

    case "TaskDependencyError": {
      return {
        title: "Task Dependency Error",
        message: `Task "${error.taskId}" has dependency issue with "${error.dependencyId}": ${error.reason}`,
        suggestion: error.suggestion || "Resolve the dependency issue",
        recovery: [
          "Check dependency task status: `crush task get <dependency-id>`",
          "Run dependency task first: `crush task run <dependency-id>`",
          "Update task dependencies: `crush task update <task-id>`",
        ],
        relatedCommands: ["crush task get", "crush task run"],
      };
    }

    case "ConfigurationError": {
      return {
        title: "Configuration Error",
        message: `Configuration error in field "${error.field}": ${error.message}`,
        suggestion: error.suggestion || "Fix the configuration value",
        recovery: [
          "Check configuration file: `crush config list`",
          "Validate configuration: `crush config validate`",
          "Reset to defaults: `crush config reset`",
        ],
        relatedCommands: ["crush config list", "crush config validate"],
      };
    }

    case "ConfigurationNotFoundError": {
      return {
        title: "Configuration File Not Found",
        message: `Configuration file not found at: ${error.path}`,
        suggestion: error.suggestion || "Create a configuration file or check the path",
        recovery: [
          "Create default config: `crush config init`",
          "Check file path and permissions",
          "Use environment variables instead",
        ],
        relatedCommands: ["crush config init", "crush config set"],
      };
    }

    case "ConfigurationValidationError": {
      return {
        title: "Configuration Validation Error",
        message: `Field "${error.field}" expected ${error.expected}, got ${String(error.actual)}`,
        suggestion: error.suggestion || "Update the configuration value to match expected format",
        recovery: [
          "Check configuration documentation",
          "Use correct data type for the field",
          "Validate configuration: `crush config validate`",
        ],
        relatedCommands: ["crush config validate", "crush config set"],
      };
    }

    case "StorageError": {
      return {
        title: "Storage Error",
        message: `Storage operation "${error.operation}" failed on "${error.path}": ${error.reason}`,
        suggestion: error.suggestion || "Check storage permissions and disk space",
        recovery: [
          "Check disk space and permissions",
          "Verify storage path exists",
          "Try different storage location",
        ],
        relatedCommands: ["crush config set storage.path"],
      };
    }

    case "StorageNotFoundError": {
      return {
        title: "Storage Not Found",
        message: `Storage location not found: ${error.path}`,
        suggestion: error.suggestion || "Create the storage directory or check the path",
        recovery: [
          "Create storage directory: `mkdir -p ${error.path}`",
          "Check storage configuration: `crush config get storage`",
          "Use different storage path",
        ],
        relatedCommands: ["crush config set storage.path"],
      };
    }

    case "StoragePermissionError": {
      return {
        title: "Storage Permission Error",
        message: `Permission denied for operation "${error.operation}" on "${error.path}"`,
        suggestion: error.suggestion || "Fix file permissions or run with appropriate privileges",
        recovery: [
          "Check file permissions: `ls -la ${error.path}`",
          "Fix permissions: `chmod 755 ${error.path}`",
          "Run with appropriate user privileges",
        ],
        relatedCommands: ["crush config set storage.path"],
      };
    }

    case "CLIError": {
      return {
        title: "CLI Error",
        message: `Command "${error.command}" failed: ${error.message}`,
        suggestion: error.suggestion || "Check command syntax and options",
        recovery: [
          "Check command help: `crush <command> --help`",
          "Verify command syntax",
          "Check required options and arguments",
        ],
        relatedCommands: ["crush --help", `crush ${error.command} --help`],
      };
    }

    case "ValidationError": {
      return {
        title: "Validation Error",
        message: `Field "${error.field}" validation failed: ${error.message}`,
        suggestion: error.suggestion || "Provide a valid value for the field",
        recovery: [
          "Check field requirements and format",
          "Use valid characters and length limits",
          "Refer to documentation for field specifications",
        ],
        relatedCommands: ["crush --help"],
      };
    }

    case "NetworkError": {
      return {
        title: "Network Error",
        message: `Network request to "${error.url}" failed: ${error.reason}`,
        suggestion: error.suggestion || "Check network connectivity and URL",
        recovery: [
          "Check internet connection",
          "Verify URL is correct and accessible",
          "Check firewall and proxy settings",
          "Retry the operation",
        ],
        relatedCommands: ["crush config get network"],
      };
    }

    case "APIError": {
      return {
        title: "API Error",
        message: `API call to "${error.endpoint}" failed with status ${error.statusCode}: ${error.message}`,
        suggestion: error.suggestion || "Check API credentials and endpoint status",
        recovery: [
          "Verify API credentials: `crush config get api`",
          "Check API service status",
          "Review API rate limits",
          "Update API configuration",
        ],
        relatedCommands: ["crush config get api", "crush auth status"],
      };
    }

    case "FileSystemError": {
      return {
        title: "File System Error",
        message: `File operation "${error.operation}" failed on "${error.path}": ${error.reason}`,
        suggestion: error.suggestion || "Check file path and permissions",
        recovery: [
          "Verify file path exists",
          "Check file permissions",
          "Ensure sufficient disk space",
        ],
        relatedCommands: ["crush config get storage"],
      };
    }

    case "FileNotFoundError": {
      return {
        title: "File Not Found",
        message: `File not found: ${error.path}`,
        suggestion: error.suggestion || "Check if the file exists and path is correct",
        recovery: [
          "Verify file path: `ls -la ${error.path}`",
          "Check file permissions",
          "Create the file if needed",
        ],
        relatedCommands: ["crush config get storage"],
      };
    }

    case "FilePermissionError": {
      return {
        title: "File Permission Error",
        message: `Permission denied for operation "${error.operation}" on "${error.path}"`,
        suggestion: error.suggestion || "Fix file permissions or run with appropriate privileges",
        recovery: [
          "Check file permissions: `ls -la ${error.path}`",
          "Fix permissions: `chmod 644 ${error.path}`",
          "Run with appropriate user privileges",
        ],
        relatedCommands: ["crush config get storage"],
      };
    }

    case "TimeoutError": {
      return {
        title: "Operation Timeout",
        message: `Operation "${error.operation}" timed out after ${error.timeout}ms`,
        suggestion: error.suggestion || "Increase timeout or optimize the operation",
        recovery: [
          "Increase operation timeout",
          "Check for resource constraints",
          "Optimize operation performance",
          "Retry the operation",
        ],
        relatedCommands: ["crush config get performance"],
      };
    }

    case "ResourceExhaustedError": {
      return {
        title: "Resource Exhausted",
        message: `Resource "${error.resource}" limit exceeded: ${error.current}/${error.limit}`,
        suggestion: error.suggestion || "Free up resources or increase limits",
        recovery: [
          "Free up system resources",
          "Increase resource limits in configuration",
          "Optimize resource usage",
          "Restart the application",
        ],
        relatedCommands: ["crush config get performance"],
      };
    }

    case "InternalError": {
      return {
        title: "Internal Error",
        message: `Internal error in ${error.component}: ${error.message}`,
        suggestion: error.suggestion || "This is an internal error. Please report it.",
        recovery: [
          "Restart the application",
          "Check application logs",
          "Report the issue to support",
          "Update to latest version",
        ],
        relatedCommands: ["crush logs", "crush --version"],
      };
    }

    case "LLMConfigurationError": {
      return {
        title: "LLM Configuration Error",
        message: `LLM provider "${error.provider}" configuration error: ${error.message}`,
        suggestion: error.suggestion || "Check your LLM provider configuration and API keys",
        recovery: [
          "Check API key configuration: `crush config get llm.${error.provider}`",
          "Set API key: `crush config set llm.${error.provider}.api_key <your-key>`",
          "Verify provider is supported",
          "Check provider documentation",
        ],
        relatedCommands: ["crush config get llm", "crush config set llm"],
      };
    }

    case "LLMAuthenticationError": {
      return {
        title: "LLM Authentication Error",
        message: `Authentication failed for LLM provider "${error.provider}": ${error.message}`,
        suggestion: error.suggestion || "Check your API credentials and authentication",
        recovery: [
          "Verify API key is correct and active",
          "Check API key permissions",
          "Regenerate API key if needed",
          "Check provider service status",
        ],
        relatedCommands: ["crush config get llm", "crush auth status"],
      };
    }

    case "GmailAuthenticationError": {
      return {
        title: "Gmail Authentication Error",
        message: `Gmail authentication failed: ${error.message}`,
        suggestion: error.suggestion || "Re-authenticate with Gmail",
        recovery: [
          "Re-authenticate: `crush auth gmail login`",
          "Check authentication status: `crush auth gmail status`",
          "Clear stored tokens: `crush auth gmail logout`",
          "Verify Google OAuth configuration",
        ],
        relatedCommands: ["crush auth gmail login", "crush auth gmail status"],
      };
    }

    case "GmailOperationError": {
      return {
        title: "Gmail Operation Error",
        message: `Gmail operation "${error.operation}" failed: ${error.message}`,
        suggestion: error.suggestion || "Check Gmail API permissions and operation parameters",
        recovery: [
          "Check Gmail API permissions",
          "Verify operation parameters",
          "Check Gmail service status",
          "Retry the operation",
        ],
        relatedCommands: ["crush auth gmail status", "crush agent run --verbose"],
      };
    }

    case "GmailTaskError": {
      return {
        title: "Gmail Task Error",
        message: `Gmail task "${error.taskId}" operation "${error.operation}" failed: ${error.message}`,
        suggestion: error.suggestion || "Check task configuration and Gmail authentication",
        recovery: [
          "Check task configuration: `crush agent get <agent-id>`",
          "Verify Gmail authentication: `crush auth gmail status`",
          "Check Gmail API permissions",
          "Review task parameters",
        ],
        relatedCommands: ["crush agent get", "crush auth gmail status"],
      };
    }

    default: {
      return {
        title: "Unknown Error",
        message: "An unexpected error occurred",
        suggestion: "Please report this error to the development team",
        recovery: ["Check application logs", "Restart the application", "Report the issue"],
        relatedCommands: ["crush logs", "crush --help"],
      };
    }
  }
}

/**
 * Format error for display with actionable suggestions
 *
 * Takes a CrushError and formats it into a user-friendly string with:
 * - Clear error title and message
 * - Actionable suggestions
 * - Step-by-step recovery instructions
 * - Related CLI commands
 *
 * @param error - The error to format
 * @returns A formatted string ready for console output
 *
 * @example
 * ```typescript
 * const error = new AgentNotFoundError({ agentId: "test-agent" });
 * const formatted = formatError(error);
 * console.error(formatted);
 * // Output: "❌ Agent Not Found\n   No agent found with ID: test-agent\n..."
 * ```
 */
export function formatError(error: CrushError): string {
  const display = generateSuggestions(error);

  let output = `❌ ${display.title}\n`;
  output += `   ${display.message}\n`;

  if (display.suggestion) {
    output += `\n💡 Suggestion: ${display.suggestion}\n`;
  }

  if (display.recovery && display.recovery.length > 0) {
    output += `\n🔧 Recovery Steps:\n`;
    display.recovery.forEach((step, index) => {
      output += `   ${index + 1}. ${step}\n`;
    });
  }

  if (display.relatedCommands && display.relatedCommands.length > 0) {
    output += `\n📚 Related Commands:\n`;
    display.relatedCommands.forEach((cmd) => {
      output += `   • ${cmd}\n`;
    });
  }

  if (display.documentation) {
    output += `\n📖 Documentation: ${display.documentation}\n`;
  }

  return output;
}

/**
 * Enhanced error handler that provides actionable suggestions
 *
 * Handles both CrushError types (with structured suggestions) and generic Error objects.
 * For CrushError types, it formats them with actionable suggestions, recovery steps, and related commands.
 * For generic Error objects, it provides a basic error message with general guidance.
 *
 * @param error - The error to handle (CrushError or generic Error)
 * @returns An Effect that logs the formatted error to the console
 *
 * @example
 * ```typescript
 * // Handle a structured error
 * const crushError = new AgentNotFoundError({ agentId: "test" });
 * yield* handleError(crushError);
 *
 * // Handle a generic error
 * const genericError = new Error("Something went wrong");
 * yield* handleError(genericError);
 * ```
 */
export function handleError(error: CrushError | Error): Effect.Effect<void> {
  return Effect.sync(() => {
    // Check if it's a CrushError (has _tag property)
    if ("_tag" in error && typeof error._tag === "string") {
      const formattedError = formatError(error);
      console.error(formattedError);
    } else {
      // Handle generic Error objects
      const genericError = error;
      console.error(
        `❌ Error\n   ${genericError.message}\n\n💡 Suggestion: Check the error details and try again\n\n📚 Related Commands:\n   • crush --help\n   • crush logs`,
      );
    }
  });
}

/**
 * Common error suggestions for frequently encountered error scenarios
 *
 * Provides reusable suggestion templates that can be used across different error types
 * to maintain consistency in error messaging and reduce duplication.
 *
 * @example
 * ```typescript
 * const error = new AgentNotFoundError({
 *   agentId: "test",
 *   suggestion: CommonSuggestions.checkAgentExists("test")
 * });
 * ```
 */
export const CommonSuggestions = {
  /**
   * Suggestion for when an agent is not found
   * @param _agentId - The agent ID that was not found (unused but kept for consistency)
   * @returns A suggestion string with commands to list or create agents
   */
  checkAgentExists: (_agentId: string) =>
    `Run 'crush agent list' to see available agents or create a new one with 'crush agent create'`,

  /**
   * Suggestion for configuration-related errors
   * @param field - The configuration field that has an issue
   * @returns A suggestion string with commands to check or update the configuration
   */
  checkConfiguration: (field: string) =>
    `Run 'crush config get ${field}' to check current value or 'crush config set ${field} <value>' to update`,

  /**
   * Suggestion for file permission errors
   * @param path - The file path that has permission issues
   * @returns A suggestion string with commands to check and fix permissions
   */
  checkPermissions: (path: string) =>
    `Check file permissions with 'ls -la ${path}' and fix with 'chmod 755 ${path}' if needed`,

  /**
   * Suggestion for network-related errors
   * @returns A suggestion string for network connectivity issues
   */
  checkNetwork: () =>
    `Check your internet connection and try again. If using a proxy, configure it in your environment`,

  /**
   * Suggestion for authentication errors
   * @param service - The service that requires authentication
   * @returns A suggestion string with commands to authenticate or check status
   */
  checkCredentials: (service: string) =>
    `Run 'crush auth ${service} login' to authenticate or check credentials with 'crush auth ${service} status'`,

  /**
   * Suggestion for timeout errors
   * @param currentTimeout - The current timeout value in milliseconds
   * @returns A suggestion string recommending a higher timeout value
   */
  increaseTimeout: (currentTimeout: number) =>
    `Try increasing the timeout to ${currentTimeout * 2}ms or more in your configuration`,

  /**
   * Suggestion for task dependency errors
   * @param taskId - The task ID that has dependency issues
   * @returns A suggestion string with commands to check task dependencies
   */
  checkDependencies: (taskId: string) =>
    `Run 'crush task deps ${taskId}' to check task dependencies and resolve any issues`,
} as const;

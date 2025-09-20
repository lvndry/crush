import chalk from "chalk";
import { Effect } from "effect";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

// Type workaround for marked v16 compatibility with marked-terminal
// Suppress unused type alias for now
// type _MarkedRenderer = Parameters<typeof marked.setOptions>[0]["renderer"];

/**
 * Markdown renderer utility for terminal output
 */
export class MarkdownRenderer {
  private static renderer: TerminalRenderer | null = null;

  /**
   * Initialize the markdown renderer with terminal-friendly options
   */
  static initialize(): void {
    try {
      // Configure marked with our terminal renderer using setOptions
      marked.setOptions({
        // @ts-expect-error marked-terminal types lag behind marked v16
        renderer: new (TerminalRenderer as unknown as new (...args: any[]) => TerminalRenderer)({
          // Color scheme for better readability
          code: chalk.cyan,
          codespan: chalk.cyan,
          blockquote: chalk.gray,
          html: chalk.gray,
          heading: chalk.bold.blue,
          firstHeading: chalk.bold.blue.underline,
          strong: chalk.bold.white,
          em: chalk.italic,
          del: chalk.strikethrough,
          link: chalk.blue.underline,
          href: chalk.gray,
          listitem: chalk.white,
          // Custom styling for better terminal experience
          paragraph: chalk.white,
          text: chalk.white,
          // Disable some features that don't work well in terminal
          showSectionPrefix: false,
          // Better spacing
          reflowText: true,
          // Maximum width for better readability
          width: 80,
        }),
        gfm: true, // GitHub Flavored Markdown
        breaks: true, // Convert line breaks to <br>
      });
    } catch (error: unknown) {
      console.error(
        "Error initializing markdown renderer:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Render markdown content to terminal-friendly text
   */
  static render(markdown: string): string {
    if (!this.renderer) {
      this.initialize();
    }

    try {
      // Use marked.parse for synchronous parsing
      return marked.parse(markdown) as string;
    } catch (error) {
      // Fallback to plain text if markdown parsing fails
      console.warn("Markdown parsing failed, falling back to plain text:", error);
      return markdown;
    }
  }

  /**
   * Render markdown content with error handling
   */
  static renderSafe(markdown: string): Effect.Effect<string, never> {
    return Effect.sync(() => this.render(markdown));
  }

  /**
   * Format agent response with proper styling
   */
  static formatAgentResponse(agentName: string, content: string): string {
    const header = chalk.bold.blue(`🤖 ${agentName}:`);
    const renderedContent = this.render(content);
    return `${header}\n${renderedContent}`;
  }

  /**
   * Format tool execution message with styling
   */
  static formatToolExecution(agentName: string, toolNames: string[]): string {
    const tools = toolNames.join(", ");
    return chalk.yellow(`🔧 ${agentName} is using tools: ${tools}`);
  }

  /**
   * Format thinking/processing message with styling
   */
  static formatThinking(agentName: string, isFirstIteration: boolean = false): string {
    const message = isFirstIteration ? "thinking..." : "processing results...";
    return chalk.cyan(`🤖 ${agentName} is ${message}`);
  }

  /**
   * Format completion message with styling
   */
  static formatCompletion(agentName: string): string {
    return chalk.green(`✅ ${agentName} completed successfully`);
  }

  /**
   * Format warning message with styling
   */
  static formatWarning(agentName: string, message: string): string {
    return chalk.yellow(`⚠️ ${agentName}: ${message}`);
  }

  /**
   * Format error message with styling
   */
  static formatError(message: string): string {
    return chalk.red(`❌ ${message}`);
  }

  /**
   * Format info message with styling
   */
  static formatInfo(message: string): string {
    return chalk.blue(`ℹ️ ${message}`);
  }

  /**
   * Format success message with styling
   */
  static formatSuccess(message: string): string {
    return chalk.green(`✅ ${message}`);
  }
}

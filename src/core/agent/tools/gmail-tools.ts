import { Effect } from "effect";
import { GmailServiceTag, type GmailEmail, type GmailService } from "../../../services/gmail";
import { type Tool, type ToolExecutionContext, type ToolExecutionResult } from "./tool-registry";

/**
 * Gmail tools for agent
 */

// List emails tool
export function createListEmailsTool(): Tool<GmailService> {
  return {
    name: "listEmails",
    description: "List the user's emails with optional filtering",
    parameters: {
      type: "object",
      properties: {
        maxResults: {
          type: "number",
          description: "Maximum number of emails to return (default: 10)",
        },
        query: {
          type: "string",
          description: "Optional query to filter emails (default: inbox)",
        },
      },
      required: [],
    },
    execute: (
      args: Record<string, unknown>,
      _context: ToolExecutionContext
    ): Effect.Effect<ToolExecutionResult, Error, GmailService> => {
      return Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;

        // Parse arguments
        const maxResults = typeof args["maxResults"] === "number" ? args["maxResults"] : 10;
        const query = typeof args["query"] === "string" ? args["query"] : "";

        try {
          // List emails
          const emails = yield* gmailService.listEmails(maxResults, query);

          return {
            success: true,
            result: formatEmailsForDisplay(emails),
          };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `Failed to list emails: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      });
    },
  };
}

// Get email tool
export function createGetEmailTool(): Tool<GmailService> {
  return {
    name: "getEmail",
    description: "Get the full content of a specific email by ID",
    parameters: {
      type: "object",
      properties: {
        emailId: {
          type: "string",
          description: "ID of the email to retrieve",
        },
      },
      required: ["emailId"],
    },
    execute: (
      args: Record<string, unknown>,
      _context: ToolExecutionContext
    ): Effect.Effect<ToolExecutionResult, Error, GmailService> => {
      return Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        void _context;

        // Parse arguments
        const emailId = args["emailId"] as string;

        if (!emailId) {
          return {
            success: false,
            result: null,
            error: "Email ID is required",
          };
        }

        try {
          // Get email
          const email = yield* gmailService.getEmail(emailId);

          return {
            success: true,
            result: formatEmailDetail(email),
          };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `Failed to get email: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      });
    },
  };
}

// Search emails tool
export function createSearchEmailsTool(): Tool<GmailService> {
  return {
    name: "searchEmails",
    description: "Search for emails matching specific criteria",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to filter emails",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of emails to return (default: 10)",
        },
      },
      required: ["query"],
    },
    execute: (
      args: Record<string, unknown>,
      _context: ToolExecutionContext
    ): Effect.Effect<ToolExecutionResult, Error, GmailService> => {
      return Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        void _context;

        // Parse arguments
        const query = args["query"] as string;
        const maxResults = typeof args["maxResults"] === "number" ? args["maxResults"] : 10;

        if (!query) {
          return {
            success: false,
            result: null,
            error: "Search query is required",
          };
        }

        try {
          // Search emails
          const emails = yield* gmailService.searchEmails(query, maxResults);

          return {
            success: true,
            result: formatEmailsForDisplay(emails),
          };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `Failed to search emails: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      });
    },
  };
}

// Send email tool
export function createSendEmailTool(): Tool<GmailService> {
  return {
    name: "sendEmail",
    description: "Send an email on behalf of the user",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Recipients of the email",
        },
        subject: {
          type: "string",
          description: "Subject of the email",
        },
        body: {
          type: "string",
          description: "Body of the email",
        },
        cc: {
          type: "array",
          items: {
            type: "string",
          },
          description: "CC recipients of the email",
        },
        bcc: {
          type: "array",
          items: {
            type: "string",
          },
          description: "BCC recipients of the email",
        },
      },
      required: ["to", "subject", "body"],
    },
    execute: (
      args: Record<string, unknown>,
      _context: ToolExecutionContext
    ): Effect.Effect<ToolExecutionResult, Error, GmailService> => {
      return Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        void _context;

        // Parse arguments
        const to = Array.isArray(args["to"]) ? (args["to"] as string[]) : [];
        const subject = args["subject"] as string;
        const body = args["body"] as string;
        const cc = Array.isArray(args["cc"]) ? (args["cc"] as string[]) : undefined;
        const bcc = Array.isArray(args["bcc"]) ? (args["bcc"] as string[]) : undefined;

        if (to.length === 0 || !subject || !body) {
          return {
            success: false,
            result: null,
            error: "Recipients, subject, and body are required",
          };
        }

        try {
          // Send email
          const options: { cc?: string[]; bcc?: string[]; } = {};
          if (cc) options.cc = cc;
          if (bcc) options.bcc = bcc;
          yield* gmailService.sendEmail(to, subject, body, options);

          return {
            success: true,
            result: `Email sent to ${to.join(", ")}`,
          };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      });
    },
  };
}

// Helper functions for formatting email data
function formatEmailsForDisplay(emails: GmailEmail[]): unknown {
  return emails.map(email => ({
    id: email.id,
    subject: email.subject,
    from: email.from,
    date: email.date,
    snippet: email.snippet,
  }));
}

function formatEmailDetail(email: GmailEmail): unknown {
  return {
    id: email.id,
    threadId: email.threadId,
    subject: email.subject,
    from: email.from,
    to: email.to,
    cc: email.cc,
    bcc: email.bcc,
    date: email.date,
    body: email.body || email.snippet,
    attachments: email.attachments?.map(attachment => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
    })),
  };
}

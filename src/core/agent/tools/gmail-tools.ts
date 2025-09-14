import { Effect } from "effect";
import { GmailServiceTag, type GmailEmail, type GmailService } from "../../../services/gmail";
import { defineTool, makeJsonSchemaValidator } from "./base-tool";
import { type Tool } from "./tool-registry";

/**
 * Gmail tools for agent
 */

// List emails tool
export function createListEmailsTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      maxResults: {
        type: "number",
        description: "Maximum emails to return",
        minimum: 1,
        maximum: 100,
        default: 10,
        examples: [5, 10, 25],
      },
      query: {
        type: "string",
        description: "Gmail search query, e.g. 'in:inbox newer_than:7d'",
        default: "",
        examples: ["in:inbox", "from:boss@example.com", "has:attachment"],
      },
    },
    required: [],
  } as const;

  return defineTool<GmailService, { maxResults?: number; query?: string }>({
    name: "listEmails",
    description: "List the user's emails with optional filtering",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;

        const maxResults =
          typeof validatedArgs.maxResults === "number" ? validatedArgs.maxResults : 10;
        const query = typeof validatedArgs.query === "string" ? validatedArgs.query : "";

        try {
          const emails = yield* gmailService.listEmails(maxResults, query);
          return { success: true, result: formatEmailsForDisplay(emails) };
        } catch (error) {
          return {
            success: false,
            result: null,
            error: `Failed to list emails: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }),
  });
}

// Get email tool
export function createGetEmailTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      emailId: {
        type: "string",
        description: "ID of the email to retrieve",
        minLength: 1,
        examples: ["185d3b2f0f0c1a2b"],
      },
    },
    required: ["emailId"],
  } as const;

  return defineTool<GmailService, { emailId: string }>({
    name: "getEmail",
    description: "Get the full content of a specific email by ID",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        const email = yield* gmailService.getEmail(validatedArgs.emailId);
        return { success: true, result: formatEmailDetail(email) };
      }),
  });
}

// Search emails tool
export function createSearchEmailsTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      query: {
        type: "string",
        description: "Gmail search query to filter emails",
        minLength: 1,
        examples: ["subject:invoice newer_than:30d"],
      },
      maxResults: {
        type: "number",
        description: "Maximum emails to return",
        minimum: 1,
        maximum: 100,
        default: 10,
      },
    },
    required: ["query"],
  } as const;

  return defineTool<GmailService, { query: string; maxResults?: number }>({
    name: "searchEmails",
    description: "Search for emails matching specific criteria",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        const maxResults =
          typeof validatedArgs.maxResults === "number" ? validatedArgs.maxResults : 10;
        const emails = yield* gmailService.searchEmails(validatedArgs.query, maxResults);
        return { success: true, result: formatEmailsForDisplay(emails) };
      }),
  });
}

// Send email tool
export function createSendEmailTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      to: {
        type: "array",
        items: { type: "string" },
        description: "Primary recipients (email addresses)",
        minItems: 1,
        examples: [["alice@example.com"]],
      },
      subject: {
        type: "string",
        description: "Email subject",
        minLength: 1,
      },
      body: {
        type: "string",
        description: "Email body (plain text)",
        minLength: 1,
      },
      cc: {
        type: "array",
        items: { type: "string" },
        description: "CC recipients",
      },
      bcc: {
        type: "array",
        items: { type: "string" },
        description: "BCC recipients",
      },
    },
    required: ["to", "subject", "body"],
  } as const;

  return defineTool<
    GmailService,
    { to: string[]; subject: string; body: string; cc?: string[]; bcc?: string[] }
  >({
    name: "sendEmail",
    description: "Send an email on behalf of the user",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        const { to, subject, body, cc, bcc } = validatedArgs;
        const options: { cc?: string[]; bcc?: string[] } = {};
        if (cc) options.cc = cc;
        if (bcc) options.bcc = bcc;
        yield* gmailService.sendEmail(to, subject, body, options);
        return { success: true, result: `Email sent to ${to.join(", ")}` };
      }),
  });
}

// Helper functions for formatting email data
function formatEmailsForDisplay(emails: GmailEmail[]): unknown {
  return emails.map((email) => ({
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
    attachments: email.attachments?.map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
    })),
  };
}

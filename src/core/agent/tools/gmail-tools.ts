import { Effect } from "effect";
import {
  GmailServiceTag,
  type GmailEmail,
  type GmailLabel,
  type GmailService,
} from "../../../services/gmail";
import { defineTool, makeJsonSchemaValidator } from "./base-tool";
import { type Tool } from "./tool-registry";

// Gmail allowed label colors
const ALLOWED_LABEL_COLORS = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#cccccc",
  "#efefef",
  "#f3f3f3",
  "#ffffff",
  "#fb4c2f",
  "#ffad47",
  "#fad165",
  "#16a766",
  "#43d692",
  "#4a86e8",
  "#a479e2",
  "#f691b3",
  "#f6c5be",
  "#ffe6c7",
  "#fef1d1",
  "#b9e4d0",
  "#c6f3de",
  "#c9daf8",
  "#e4d7f5",
  "#fcdee8",
  "#efa093",
  "#ffd6a2",
  "#fce8b3",
  "#89d3b2",
  "#a0eac9",
  "#a4c2f4",
  "#d0bcf1",
  "#fbc8d9",
  "#e66550",
  "#ffbc6b",
  "#fcda83",
  "#44b984",
  "#68dfa9",
  "#6d9eeb",
  "#b694e8",
  "#f7a7c0",
  "#cc3a21",
  "#eaa041",
  "#f2c960",
  "#149e60",
  "#3dc789",
  "#3c78d8",
  "#8e63ce",
  "#e07798",
  "#ac2b16",
  "#cf8933",
  "#d5ae49",
  "#0b804b",
  "#2a9c68",
  "#285bac",
  "#653e9b",
  "#b65775",
  "#822111",
  "#a46a21",
  "#aa8831",
  "#076239",
  "#1a764d",
  "#1c4587",
  "#41236d",
  "#83334c",
  "#464646",
  "#e7e7e7",
  "#0d3472",
  "#b6cff5",
  "#0d3b44",
  "#98d7e4",
  "#3d188e",
  "#e3d7ff",
  "#711a36",
  "#fbd3e0",
  "#8a1c0a",
  "#f2b2a8",
  "#7a2e0b",
  "#ffc8af",
  "#7a4706",
  "#ffdeb5",
  "#594c05",
  "#fbe983",
  "#684e07",
  "#fdedc1",
  "#0b4f30",
  "#b3efd3",
  "#04502e",
  "#a2dcc1",
  "#c2c2c2",
  "#4986e7",
  "#2da2bb",
  "#b99aff",
  "#994a64",
  "#f691b2",
  "#ff7537",
  "#ffad46",
  "#662e37",
  "#ebdbde",
  "#cca6ac",
  "#094228",
  "#42d692",
  "#16a765",
] as const;

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
    description: "Draft an email on behalf of the user (does not send)",
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
        return { success: true, result: `Draft created for ${to.join(", ")}` };
      }),
  });
}

// List labels tool
export function createListLabelsTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  } as const;

  return defineTool<GmailService, Record<string, never>>({
    name: "listLabels",
    description: "List all Gmail labels (both system and user-created)",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: () =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        const labels = yield* gmailService.listLabels();
        return { success: true, result: formatLabelsForDisplay(labels) };
      }),
  });
}

// Create label tool
export function createCreateLabelTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        description: "Name of the label to create",
        minLength: 1,
        examples: ["Work", "Personal", "Important"],
      },
      labelListVisibility: {
        type: "string",
        enum: ["labelShow", "labelHide"],
        description: "Whether to show the label in the label list",
        default: "labelShow",
      },
      messageListVisibility: {
        type: "string",
        enum: ["show", "hide"],
        description: "Whether to show the label in the message list",
        default: "show",
      },
      color: {
        type: "object",
        description: "Color settings for the label",
        properties: {
          textColor: {
            type: "string",
            description: "Text color (must be one of the allowed Gmail label colors)",
            enum: ALLOWED_LABEL_COLORS,
            default: "#000000",
          },
          backgroundColor: {
            type: "string",
            description: "Background color (must be one of the allowed Gmail label colors)",
            enum: ALLOWED_LABEL_COLORS,
            default: "#ffffff",
          },
        },
        required: ["textColor", "backgroundColor"],
      },
    },
    required: ["name"],
  } as const;

  return defineTool<
    GmailService,
    {
      name: string;
      labelListVisibility?: "labelShow" | "labelHide";
      messageListVisibility?: "show" | "hide";
      color?: { textColor: string; backgroundColor: string };
    }
  >({
    name: "createLabel",
    description: "Create a new Gmail label with optional visibility and color settings",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        const { name, labelListVisibility, messageListVisibility, color } = validatedArgs;
        const options: {
          labelListVisibility?: "labelShow" | "labelHide";
          messageListVisibility?: "show" | "hide";
          color?: { textColor: string; backgroundColor: string };
        } = {};
        if (labelListVisibility) options.labelListVisibility = labelListVisibility;
        if (messageListVisibility) options.messageListVisibility = messageListVisibility;
        if (color) options.color = color;

        const createResult = yield* gmailService.createLabel(name, options).pipe(
          Effect.catchAll((error) => {
            // Check if it's a 409 conflict error (label already exists)
            if (error instanceof Error && "status" in error && error.status === 409) {
              // Return a special marker to indicate the label already exists
              return Effect.succeed("LABEL_EXISTS" as const);
            }
            return Effect.fail(error);
          }),
        );

        // Handle the case where label already exists
        if (createResult === "LABEL_EXISTS") {
          return { success: true, result: `Label "${name}" already exists` };
        }

        // If we get here, the label was created successfully
        return { success: true, result: formatLabelForDisplay(createResult) };
      }),
  });
}

// Update label tool
export function createUpdateLabelTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      labelId: {
        type: "string",
        description: "ID of the label to update",
        minLength: 1,
        examples: ["Label_1", "Label_2"],
      },
      name: {
        type: "string",
        description: "New name for the label",
        minLength: 1,
      },
      labelListVisibility: {
        type: "string",
        enum: ["labelShow", "labelHide"],
        description: "Whether to show the label in the label list",
      },
      messageListVisibility: {
        type: "string",
        enum: ["show", "hide"],
        description: "Whether to show the label in the message list",
      },
      color: {
        type: "object",
        description: "Color settings for the label",
        properties: {
          textColor: {
            type: "string",
            description: "Text color (must be one of the allowed Gmail label colors)",
            enum: ALLOWED_LABEL_COLORS,
          },
          backgroundColor: {
            type: "string",
            description: "Background color (must be one of the allowed Gmail label colors)",
            enum: ALLOWED_LABEL_COLORS,
          },
        },
        required: ["textColor", "backgroundColor"],
      },
    },
    required: ["labelId"],
  } as const;

  return defineTool<
    GmailService,
    {
      labelId: string;
      name?: string;
      labelListVisibility?: "labelShow" | "labelHide";
      messageListVisibility?: "show" | "hide";
      color?: { textColor: string; backgroundColor: string };
    }
  >({
    name: "updateLabel",
    description: "Update an existing Gmail label's properties",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        const { labelId, name, labelListVisibility, messageListVisibility, color } = validatedArgs;
        const updates: {
          name?: string;
          labelListVisibility?: "labelShow" | "labelHide";
          messageListVisibility?: "show" | "hide";
          color?: { textColor: string; backgroundColor: string };
        } = {};
        if (name !== undefined) updates.name = name;
        if (labelListVisibility !== undefined) updates.labelListVisibility = labelListVisibility;
        if (messageListVisibility !== undefined)
          updates.messageListVisibility = messageListVisibility;
        if (color !== undefined) updates.color = color;

        const label = yield* gmailService.updateLabel(labelId, updates);
        return { success: true, result: formatLabelForDisplay(label) };
      }),
  });
}

// Delete label tool
export function createDeleteLabelTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      labelId: {
        type: "string",
        description: "ID of the label to delete",
        minLength: 1,
        examples: ["Label_1", "Label_2"],
      },
    },
    required: ["labelId"],
  } as const;
  return defineTool<GmailService, { labelId: string }>({
    name: "deleteLabel",
    description: "Delete a Gmail label (only user-created labels can be deleted)",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    approval: {
      message: (args, _context) => {
        const a = args as { labelId: string };
        return Effect.succeed(
          `About to permanently delete label '${a.labelId}'. This action cannot be undone.\n\nIf the user confirms, call executeDeleteLabel with the same labelId.`,
        );
      },
      execute: {
        toolName: "executeDeleteLabel",
        buildArgs: (args) => ({ labelId: (args as { labelId: string }).labelId }),
      },
    },
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        yield* gmailService.deleteLabel(validatedArgs.labelId);
        return { success: true, result: `Label ${validatedArgs.labelId} deleted successfully` };
      }),
  });
}

// Trash email tool (requires approval)
export function createTrashEmailTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      emailId: {
        type: "string",
        description: "ID of the email to move to trash",
        minLength: 1,
        examples: ["185d3b2f0f0c1a2b"],
      },
    },
    required: ["emailId"],
  } as const;

  return defineTool<GmailService, { emailId: string }>({
    name: "trashEmail",
    description: "Move an email to trash (recoverable). Use this for safer email removal.",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    approval: {
      message: (args, _context) =>
        Effect.gen(function* () {
          const a = args as { emailId: string };
          const gmailService = yield* GmailServiceTag;

          try {
            const email = yield* gmailService.getEmail(a.emailId);
            const preview = createEmailPreviewMessage(email);
            return `${preview}\n\n🗑️  About to move this email to trash. It can be recovered later.\n\nIf the user confirms, call executeTrashEmail with the same emailId.`;
          } catch (error) {
            // If we can't fetch email details, fall back to basic message
            return `About to move email '${a.emailId}' to trash. It can be recovered later.\n(Note: Could not fetch email details: ${error instanceof Error ? error.message : String(error)})`;
          }
        }),
      execute: {
        toolName: "executeTrashEmail",
        buildArgs: (args) => ({ emailId: (args as { emailId: string }).emailId }),
      },
    },
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        yield* gmailService.trashEmail(validatedArgs.emailId);
        return { success: true, result: `Email ${validatedArgs.emailId} moved to trash` };
      }),
  });
}

// Delete email tool (requires approval)
export function createDeleteEmailTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      emailId: {
        type: "string",
        description: "ID of the email to delete permanently",
        minLength: 1,
        examples: ["185d3b2f0f0c1a2b"],
      },
    },
    required: ["emailId"],
  } as const;

  return defineTool<GmailService, { emailId: string }>({
    name: "deleteEmail",
    description:
      "Permanently delete an email. This action cannot be undone. Consider using trashEmail for safer removal.",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    approval: {
      message: (args, _context) =>
        Effect.gen(function* () {
          const a = args as { emailId: string };
          const gmailService = yield* GmailServiceTag;

          try {
            const email = yield* gmailService.getEmail(a.emailId);
            const preview = createEmailPreviewMessage(email);
            return `${preview}\n\n⚠️  About to PERMANENTLY DELETE this email. This cannot be undone!\n\nIf the user confirms, call executeDeleteEmail with the same emailId.`;
          } catch (error) {
            // If we can't fetch email details, fall back to basic message
            return `About to permanently delete email '${a.emailId}'. This cannot be undone!\n(Note: Could not fetch email details: ${error instanceof Error ? error.message : String(error)})`;
          }
        }),
      execute: {
        toolName: "executeDeleteEmail",
        buildArgs: (args) => ({ emailId: (args as { emailId: string }).emailId }),
      },
    },
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        yield* gmailService.deleteEmail(validatedArgs.emailId);
        return { success: true, result: `Email ${validatedArgs.emailId} deleted permanently` };
      }),
  });
}

// Execute trash email tool (internal - called after approval)
export function createExecuteTrashEmailTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      emailId: {
        type: "string",
        description: "ID of the email to move to trash",
        minLength: 1,
        examples: ["185d3b2f0f0c1a2b"],
      },
    },
    required: ["emailId"],
  } as const;

  return defineTool<GmailService, { emailId: string }>({
    name: "executeTrashEmail",
    description: "Execute the trash email action after user approval",
    hidden: true,
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        yield* gmailService.trashEmail(validatedArgs.emailId);
        return { success: true, result: `Email ${validatedArgs.emailId} moved to trash` };
      }),
  });
}

// Execute delete email tool (internal - called after approval)
export function createExecuteDeleteEmailTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      emailId: {
        type: "string",
        description: "ID of the email to delete permanently",
        minLength: 1,
        examples: ["185d3b2f0f0c1a2b"],
      },
    },
    required: ["emailId"],
  } as const;

  return defineTool<GmailService, { emailId: string }>({
    name: "executeDeleteEmail",
    description: "Execute the delete email action after user approval",
    hidden: true,
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        yield* gmailService.deleteEmail(validatedArgs.emailId);
        return { success: true, result: `Email ${validatedArgs.emailId} deleted permanently` };
      }),
  });
}

// Execute delete label tool (internal - called after approval)
export function createExecuteDeleteLabelTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      labelId: {
        type: "string",
        description: "ID of the label to delete",
        minLength: 1,
        examples: ["Label_1", "Label_2"],
      },
    },
    required: ["labelId"],
  } as const;

  return defineTool<GmailService, { labelId: string }>({
    name: "executeDeleteLabel",
    description: "Execute the delete label action after user approval",
    hidden: true,
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        yield* gmailService.deleteLabel(validatedArgs.labelId);
        return { success: true, result: `Label ${validatedArgs.labelId} deleted successfully` };
      }),
  });
}

// Add labels to email tool
export function createAddLabelsToEmailTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      emailId: {
        type: "string",
        description: "ID of the email to add labels to",
        minLength: 1,
        examples: ["185d3b2f0f0c1a2b"],
      },
      labelIds: {
        type: "array",
        items: { type: "string" },
        description: "Array of label IDs to add to the email",
        minItems: 1,
        examples: [["Label_1", "Label_2"]],
      },
    },
    required: ["emailId", "labelIds"],
  } as const;

  return defineTool<GmailService, { emailId: string; labelIds: string[] }>({
    name: "addLabelsToEmail",
    description: "Add one or more labels to a specific email",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        const email = yield* gmailService.modifyEmail(validatedArgs.emailId, {
          addLabelIds: validatedArgs.labelIds,
        });
        return { success: true, result: formatEmailDetail(email) };
      }),
  });
}

// Remove labels from email tool
export function createRemoveLabelsFromEmailTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      emailId: {
        type: "string",
        description: "ID of the email to remove labels from",
        minLength: 1,
        examples: ["185d3b2f0f0c1a2b"],
      },
      labelIds: {
        type: "array",
        items: { type: "string" },
        description: "Array of label IDs to remove from the email",
        minItems: 1,
        examples: [["Label_1", "Label_2"]],
      },
    },
    required: ["emailId", "labelIds"],
  } as const;

  return defineTool<GmailService, { emailId: string; labelIds: string[] }>({
    name: "removeLabelsFromEmail",
    description: "Remove one or more labels from a specific email",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        const email = yield* gmailService.modifyEmail(validatedArgs.emailId, {
          removeLabelIds: validatedArgs.labelIds,
        });
        return { success: true, result: formatEmailDetail(email) };
      }),
  });
}

// Batch modify emails tool
export function createBatchModifyEmailsTool(): Tool<GmailService> {
  const parameters = {
    type: "object",
    additionalProperties: false,
    properties: {
      emailIds: {
        type: "array",
        items: { type: "string" },
        description: "Array of email IDs to modify",
        minItems: 1,
        maxItems: 1000,
        examples: [["185d3b2f0f0c1a2b", "285d3b2f0f0c1a2c"]],
      },
      addLabelIds: {
        type: "array",
        items: { type: "string" },
        description: "Array of label IDs to add to all emails",
        examples: [["Label_1", "Label_2"]],
      },
      removeLabelIds: {
        type: "array",
        items: { type: "string" },
        description: "Array of label IDs to remove from all emails",
        examples: [["Label_3", "Label_4"]],
      },
    },
    required: ["emailIds"],
  } as const;

  return defineTool<
    GmailService,
    {
      emailIds: string[];
      addLabelIds?: string[];
      removeLabelIds?: string[];
    }
  >({
    name: "batchModifyEmails",
    description: "Modify multiple emails at once by adding or removing labels",
    parameters,
    validate: makeJsonSchemaValidator(parameters as unknown as Record<string, unknown>),
    handler: (validatedArgs) =>
      Effect.gen(function* () {
        const gmailService = yield* GmailServiceTag;
        const { emailIds, addLabelIds, removeLabelIds } = validatedArgs;
        const options: {
          addLabelIds?: string[];
          removeLabelIds?: string[];
        } = {};
        if (addLabelIds) options.addLabelIds = addLabelIds;
        if (removeLabelIds) options.removeLabelIds = removeLabelIds;

        yield* gmailService.batchModifyEmails(emailIds, options);
        return {
          success: true,
          result: `Successfully modified ${emailIds.length} emails`,
        };
      }),
  });
}

// Helper function to create email preview for approval messages
function createEmailPreviewMessage(email: GmailEmail): string {
  const now = new Date();
  const emailDate = new Date(email.date);
  const daysInInbox = Math.floor((now.getTime() - emailDate.getTime()) / (1000 * 60 * 60 * 24));

  const isImportant = email.labels?.includes("IMPORTANT") || false;
  const labels =
    email.labels?.filter(
      (label) => !["INBOX", "UNREAD", "STARRED", "SENT", "DRAFT", "SPAM", "TRASH"].includes(label),
    ) || [];

  const labelsText = labels.length > 0 ? `\nLabels: ${labels.join(", ")}` : "";
  const importantText = isImportant ? "\n⚠️  IMPORTANT" : "";
  const daysText =
    daysInInbox === 0 ? "Today" : daysInInbox === 1 ? "1 day ago" : `${daysInInbox} days ago`;

  return `📧 Email Preview:
Subject: ${email.subject}
From: ${email.from}
Date: ${daysText} (${emailDate.toLocaleDateString()})${importantText}${labelsText}
Snippet: ${email.snippet.substring(0, 100)}${email.snippet.length > 100 ? "..." : ""}`;
}

// Helper functions for formatting email data
function formatEmailsForDisplay(emails: GmailEmail[]): unknown {
  return emails.map((email) => ({
    id: email.id,
    subject: email.subject,
    from: email.from,
    date: email.date,
    snippet: email.snippet,
    labels: email.labels,
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
    labels: email.labels,
    attachments: email.attachments?.map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
    })),
  };
}

function formatLabelsForDisplay(labels: GmailLabel[]): unknown {
  return labels.map((label) => ({
    id: label.id,
    name: label.name,
    type: label.type,
    messagesTotal: label.messagesTotal,
    messagesUnread: label.messagesUnread,
    threadsTotal: label.threadsTotal,
    threadsUnread: label.threadsUnread,
    color: label.color,
    labelListVisibility: label.labelListVisibility,
    messageListVisibility: label.messageListVisibility,
  }));
}

function formatLabelForDisplay(label: GmailLabel): unknown {
  return {
    id: label.id,
    name: label.name,
    type: label.type,
    messagesTotal: label.messagesTotal,
    messagesUnread: label.messagesUnread,
    threadsTotal: label.threadsTotal,
    threadsUnread: label.threadsUnread,
    color: label.color,
    labelListVisibility: label.labelListVisibility,
    messageListVisibility: label.messageListVisibility,
  };
}

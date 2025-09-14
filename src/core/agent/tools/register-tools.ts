import { Effect, Layer } from "effect";
import {
  createGetEmailTool,
  createListEmailsTool,
  createSearchEmailsTool,
  createSendEmailTool,
} from "./gmail-tools";
import { ToolRegistryTag, type ToolRegistry } from "./tool-registry";

/**
 * Tool registration module
 */

// Register all tools
export function registerAllTools(): Effect.Effect<void, Error, ToolRegistry> {
  return Effect.gen(function* () {
    // Register Gmail tools
    yield* registerGmailTools();

    // Register other tool categories as needed
    // yield* registerFileTools();
    // yield* registerWebTools();
    // etc.
  });
}

// Register Gmail tools
export function registerGmailTools(): Effect.Effect<void, Error, ToolRegistry> {
  return Effect.gen(function* () {
    const registry = yield* ToolRegistryTag;

    // Create Gmail tools
    const listEmailsTool = createListEmailsTool();
    const getEmailTool = createGetEmailTool();
    const searchEmailsTool = createSearchEmailsTool();
    const sendEmailTool = createSendEmailTool();

    // Register Gmail tools
    yield* registry.registerTool(listEmailsTool);
    yield* registry.registerTool(getEmailTool);
    yield* registry.registerTool(searchEmailsTool);
    yield* registry.registerTool(sendEmailTool);
  });
}

// Create a layer that registers all tools
export function createToolRegistrationLayer(): Layer.Layer<never, Error, ToolRegistry> {
  return Layer.effectDiscard(registerAllTools());
}

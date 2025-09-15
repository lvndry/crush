import { Effect, Layer } from "effect";
import {
  createCdTool,
  createExecuteMkdirTool,
  createExecuteRmTool,
  createFindDirTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createMkdirTool,
  createPwdTool,
  createRmTool,
} from "./fs-tools";
import {
  createAddLabelsToEmailTool,
  createBatchModifyEmailsTool,
  createCreateLabelTool,
  createDeleteEmailTool,
  createDeleteLabelTool,
  createExecuteDeleteEmailTool,
  createExecuteDeleteLabelTool,
  createExecuteTrashEmailTool,
  createGetEmailTool,
  createListEmailsTool,
  createListLabelsTool,
  createRemoveLabelsFromEmailTool,
  createSearchEmailsTool,
  createSendEmailTool,
  createTrashEmailTool,
  createUpdateLabelTool,
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
    yield* registerFileTools();
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
    const trashEmailTool = createTrashEmailTool();
    const deleteEmailTool = createDeleteEmailTool();

    // Create execution tools
    const executeTrashEmailTool = createExecuteTrashEmailTool();
    const executeDeleteEmailTool = createExecuteDeleteEmailTool();
    const executeDeleteLabelTool = createExecuteDeleteLabelTool();

    // Create Gmail label management tools
    const listLabelsTool = createListLabelsTool();
    const createLabelTool = createCreateLabelTool();
    const updateLabelTool = createUpdateLabelTool();
    const deleteLabelTool = createDeleteLabelTool();

    // Create Gmail email organization tools
    const addLabelsToEmailTool = createAddLabelsToEmailTool();
    const removeLabelsFromEmailTool = createRemoveLabelsFromEmailTool();
    const batchModifyEmailsTool = createBatchModifyEmailsTool();

    // Register Gmail tools
    yield* registry.registerTool(listEmailsTool);
    yield* registry.registerTool(getEmailTool);
    yield* registry.registerTool(searchEmailsTool);
    yield* registry.registerTool(sendEmailTool);
    yield* registry.registerTool(trashEmailTool);
    yield* registry.registerTool(deleteEmailTool);

    // Register execution tools
    yield* registry.registerTool(executeTrashEmailTool);
    yield* registry.registerTool(executeDeleteEmailTool);
    yield* registry.registerTool(executeDeleteLabelTool);

    // Register Gmail label management tools
    yield* registry.registerTool(listLabelsTool);
    yield* registry.registerTool(createLabelTool);
    yield* registry.registerTool(updateLabelTool);
    yield* registry.registerTool(deleteLabelTool);

    // Register Gmail email organization tools
    yield* registry.registerTool(addLabelsToEmailTool);
    yield* registry.registerTool(removeLabelsFromEmailTool);
    yield* registry.registerTool(batchModifyEmailsTool);
  });
}

// Register filesystem tools
export function registerFileTools(): Effect.Effect<void, Error, ToolRegistry> {
  return Effect.gen(function* () {
    const registry = yield* ToolRegistryTag;

    const pwd = createPwdTool();
    const ls = createLsTool();
    const cd = createCdTool();
    const grep = createGrepTool();
    const find = createFindTool();
    const finddir = createFindDirTool();
    const mkdir = createMkdirTool();
    const executeMkdir = createExecuteMkdirTool();
    const rm = createRmTool();
    const executeRm = createExecuteRmTool();

    yield* registry.registerTool(pwd);
    yield* registry.registerTool(ls);
    yield* registry.registerTool(cd);
    yield* registry.registerTool(grep);
    yield* registry.registerTool(find);
    yield* registry.registerTool(finddir);
    yield* registry.registerTool(mkdir);
    yield* registry.registerTool(executeMkdir);
    yield* registry.registerTool(rm);
    yield* registry.registerTool(executeRm);
  });
}

// Create a layer that registers all tools
export function createToolRegistrationLayer(): Layer.Layer<never, Error, ToolRegistry> {
  return Layer.effectDiscard(registerAllTools());
}

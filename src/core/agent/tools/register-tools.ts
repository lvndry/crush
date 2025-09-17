import { Effect, Layer } from "effect";
import {
  createCdTool,
  createExecuteMkdirTool,
  createExecuteRmTool,
  createExecuteWriteFileTool,
  createFindDirTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createMkdirTool,
  createPwdTool,
  createReadFileTool,
  createRmTool,
  createStatTool,
  createWriteFileTool,
} from "./fs-tools";
import {
  createGitAddTool,
  createGitBranchTool,
  createGitCheckoutTool,
  createGitCommitTool,
  createGitDiffTool,
  createGitLogTool,
  createGitPullTool,
  createGitPushTool,
  createGitStatusTool,
} from "./git-tools";
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
import { createExecuteCommandApprovedTool, createExecuteCommandTool } from "./shell-tools";
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
    yield* registerShellTools();
    yield* registerGitTools();
    // yield* registerWebTools();
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
    const readFile = createReadFileTool();
    const find = createFindTool();
    const finddir = createFindDirTool();
    const stat = createStatTool();
    const mkdir = createMkdirTool();
    const executeMkdir = createExecuteMkdirTool();
    const rm = createRmTool();
    const executeRm = createExecuteRmTool();
    const writeFile = createWriteFileTool();
    const executeWriteFile = createExecuteWriteFileTool();

    yield* registry.registerTool(pwd);
    yield* registry.registerTool(ls);
    yield* registry.registerTool(cd);
    yield* registry.registerTool(grep);
    yield* registry.registerTool(readFile);
    yield* registry.registerTool(writeFile);
    yield* registry.registerTool(find);
    yield* registry.registerTool(finddir);
    yield* registry.registerTool(stat);
    yield* registry.registerTool(mkdir);
    yield* registry.registerTool(executeMkdir);
    yield* registry.registerTool(rm);
    yield* registry.registerTool(executeRm);
    yield* registry.registerTool(executeWriteFile);
  });
}

// Register shell command execution tools
export function registerShellTools(): Effect.Effect<void, Error, ToolRegistry> {
  return Effect.gen(function* () {
    const registry = yield* ToolRegistryTag;

    const executeCommandTool = createExecuteCommandTool();
    const executeCommandApprovedTool = createExecuteCommandApprovedTool();

    yield* registry.registerTool(executeCommandTool);
    yield* registry.registerTool(executeCommandApprovedTool);
  });
}

// Register Git tools
export function registerGitTools(): Effect.Effect<void, Error, ToolRegistry> {
  return Effect.gen(function* () {
    const registry = yield* ToolRegistryTag;

    // Safe Git operations (no approval needed)
    const gitStatusTool = createGitStatusTool();
    const gitLogTool = createGitLogTool();
    const gitDiffTool = createGitDiffTool();
    const gitBranchTool = createGitBranchTool();

    // Potentially destructive operations (approval required)
    const gitAddTool = createGitAddTool();
    const gitCommitTool = createGitCommitTool();
    const gitPushTool = createGitPushTool();
    const gitPullTool = createGitPullTool();
    const gitCheckoutTool = createGitCheckoutTool();

    // Register safe tools
    yield* registry.registerTool(gitStatusTool);
    yield* registry.registerTool(gitLogTool);
    yield* registry.registerTool(gitDiffTool);
    yield* registry.registerTool(gitBranchTool);

    // Register approval-required tools
    yield* registry.registerTool(gitAddTool);
    yield* registry.registerTool(gitCommitTool);
    yield* registry.registerTool(gitPushTool);
    yield* registry.registerTool(gitPullTool);
    yield* registry.registerTool(gitCheckoutTool);
  });
}

// Create a layer that registers all tools
export function createToolRegistrationLayer(): Layer.Layer<never, Error, ToolRegistry> {
  return Layer.effectDiscard(registerAllTools());
}

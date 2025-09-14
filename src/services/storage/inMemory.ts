import { Effect, Layer, Ref } from "effect";
import { StorageError, StorageNotFoundError } from "../../core/types/errors";
import type { Agent, AgentResult, Automation, TaskResult } from "../../core/types/index";
import { StorageServiceTag, type StorageService } from "./service";

export class InMemoryStorageService implements StorageService {
  constructor(
    private readonly agents: Ref.Ref<Map<string, Agent>>,
    private readonly automations: Ref.Ref<Map<string, Automation>>,
    private readonly taskResults: Ref.Ref<Map<string, TaskResult[]>>,
    private readonly agentResults: Ref.Ref<Map<string, AgentResult[]>>,
  ) {}

  saveAgent(agent: Agent): Effect.Effect<void, StorageError> {
    return Ref.update(this.agents, (map) => new Map(map.set(agent.id, agent)));
  }

  getAgent(id: string): Effect.Effect<Agent, StorageError | StorageNotFoundError> {
    return Effect.flatMap(Ref.get(this.agents), (agents) => {
      const agent = agents.get(id);
      if (!agent) {
        return Effect.fail(new StorageNotFoundError({ path: `agent:${id}` }));
      }
      return Effect.succeed(agent);
    });
  }

  listAgents(): Effect.Effect<readonly Agent[], StorageError> {
    return Effect.map(Ref.get(this.agents), (agents) => Array.from(agents.values()));
  }

  deleteAgent(id: string): Effect.Effect<void, StorageError | StorageNotFoundError> {
    return Effect.flatMap(Ref.get(this.agents), (agents) => {
      if (!agents.has(id)) {
        return Effect.fail(new StorageNotFoundError({ path: `agent:${id}` }));
      }
      return Ref.update(this.agents, (map) => {
        const newMap = new Map(map);
        newMap.delete(id);
        return newMap;
      });
    });
  }

  saveAutomation(automation: Automation): Effect.Effect<void, StorageError> {
    return Ref.update(this.automations, (map) => new Map(map.set(automation.id, automation)));
  }

  getAutomation(id: string): Effect.Effect<Automation, StorageError | StorageNotFoundError> {
    return Effect.flatMap(Ref.get(this.automations), (automations) => {
      const automation = automations.get(id);
      if (!automation) {
        return Effect.fail(new StorageNotFoundError({ path: `automation:${id}` }));
      }
      return Effect.succeed(automation);
    });
  }

  listAutomations(): Effect.Effect<readonly Automation[], StorageError> {
    return Effect.map(Ref.get(this.automations), (automations) => Array.from(automations.values()));
  }

  deleteAutomation(id: string): Effect.Effect<void, StorageError | StorageNotFoundError> {
    return Effect.flatMap(Ref.get(this.automations), (automations) => {
      if (!automations.has(id)) {
        return Effect.fail(new StorageNotFoundError({ path: `automation:${id}` }));
      }
      return Ref.update(this.automations, (map) => {
        const newMap = new Map(map);
        newMap.delete(id);
        return newMap;
      });
    });
  }

  saveTaskResult(result: TaskResult): Effect.Effect<void, StorageError> {
    return Ref.update(this.taskResults, (map) => {
      const newMap = new Map(map);
      const existing = newMap.get(result.taskId) || [];
      newMap.set(result.taskId, [...existing, result]);
      return newMap;
    });
  }

  getTaskResults(taskId: string): Effect.Effect<readonly TaskResult[], StorageError> {
    return Effect.map(Ref.get(this.taskResults), (results) => results.get(taskId) || []);
  }

  saveAgentResult(result: AgentResult): Effect.Effect<void, StorageError> {
    return Ref.update(this.agentResults, (map) => {
      const newMap = new Map(map);
      const existing = newMap.get(result.agentId) || [];
      newMap.set(result.agentId, [...existing, result]);
      return newMap;
    });
  }

  getAgentResults(agentId: string): Effect.Effect<readonly AgentResult[], StorageError> {
    return Effect.map(Ref.get(this.agentResults), (results) => results.get(agentId) || []);
  }
}

export function createInMemoryStorageLayer(): Layer.Layer<StorageService> {
  return Layer.effect(
    StorageServiceTag,
    Effect.gen(function* () {
      const agents = yield* Ref.make(new Map<string, Agent>());
      const automations = yield* Ref.make(new Map<string, Automation>());
      const taskResults = yield* Ref.make(new Map<string, TaskResult[]>());
      const agentResults = yield* Ref.make(new Map<string, AgentResult[]>());

      return new InMemoryStorageService(agents, automations, taskResults, agentResults);
    }),
  );
}

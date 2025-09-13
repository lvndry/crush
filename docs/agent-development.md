# Agent Development Guide

This guide explains how to create, configure, and manage agents in Crush.

## 🤖 What is an Agent?

An agent in Crush is an autonomous entity that can execute a series of tasks to accomplish specific automation goals. Agents are:

- **Autonomous**: Can run independently with minimal human intervention
- **Configurable**: Support various settings for timeout, retry policies, and environment variables
- **Composable**: Can contain multiple tasks with dependencies
- **Persistent**: Stored on disk and can be managed across sessions

## 🏗️ Agent Structure

### Core Properties

Every agent has these essential properties:

```typescript
interface Agent {
  readonly id: string;           // Unique identifier (UUID)
  readonly name: string;         // Human-readable name
  readonly description: string;  // Purpose and functionality description
  readonly config: AgentConfig;  // Configuration and tasks
  readonly status: AgentStatus;  // Current execution status
  readonly createdAt: Date;      // Creation timestamp
  readonly updatedAt: Date;      // Last modification timestamp
}
```

### Agent Configuration

```typescript
interface AgentConfig {
  readonly tasks: readonly Task[];        // List of tasks to execute
  readonly schedule?: Schedule;           // Optional scheduling configuration
  readonly retryPolicy?: RetryPolicy;     // Retry behavior for failed tasks
  readonly timeout?: number;              // Global timeout in milliseconds
  readonly environment?: Record<string, string>; // Environment variables
}
```

### Agent Status

Agents can be in one of these states:

- `idle` - Ready to run, not currently executing
- `running` - Currently executing tasks
- `paused` - Temporarily stopped
- `error` - Failed with an error
- `completed` - Finished execution successfully

## 📝 Creating Agents

### Basic Agent Creation

```bash
# Create a simple agent
crush agent create my-agent --description "My first automation agent"
```

### Advanced Agent Creation

```bash
# Create agent with custom configuration
crush agent create backup-agent \
  --description "Automated backup agent for daily backups" \
  --timeout 300000 \
  --max-retries 5 \
  --retry-delay 2000 \
  --retry-backoff exponential
```

### Agent Naming Conventions

Follow these naming conventions for better organization:

- Use kebab-case: `web-scraper`, `data-processor`, `report-generator`
- Be descriptive: `daily-backup`, `weekly-cleanup`, `api-monitor`
- Include purpose: `user-sync`, `inventory-update`, `log-analyzer`

## ⚙️ Agent Configuration

### Timeout Configuration

Set how long an agent can run before timing out:

```bash
# 5 minutes timeout
crush agent create long-running-agent --timeout 300000

# 1 hour timeout
crush agent create batch-processor --timeout 3600000
```

**Timeout Guidelines:**
- Short tasks: 30 seconds - 5 minutes
- Medium tasks: 5 - 30 minutes
- Long tasks: 30 minutes - 2 hours
- Maximum: 1 hour (3600000ms)

### Retry Policy

Configure how agents handle failures:

```typescript
interface RetryPolicy {
  readonly maxRetries: number;                    // Maximum retry attempts (0-10)
  readonly backoff: "linear" | "exponential" | "fixed"; // Backoff strategy
  readonly delay: number;                         // Initial delay in milliseconds
  readonly maxDelay?: number;                     // Maximum delay cap
}
```

**Retry Strategies:**

1. **Linear Backoff**: Constant delay between retries
   ```
   Retry 1: 1000ms delay
   Retry 2: 1000ms delay
   Retry 3: 1000ms delay
   ```

2. **Exponential Backoff**: Increasing delay (recommended)
   ```
   Retry 1: 1000ms delay
   Retry 2: 2000ms delay
   Retry 3: 4000ms delay
   ```

3. **Fixed Backoff**: Same delay for all retries
   ```
   Retry 1: 1000ms delay
   Retry 2: 1000ms delay
   Retry 3: 1000ms delay
   ```

**Example Configuration:**
```bash
crush agent create resilient-agent \
  --max-retries 3 \
  --retry-delay 1000 \
  --retry-backoff exponential
```

### Environment Variables

Agents can have custom environment variables:

```bash
# Environment variables are set when creating tasks
# (This will be implemented in future versions)
```

## 📋 Task Configuration

### Task Types

Crush supports multiple task types:

#### 1. Command Tasks
Execute shell commands:

```typescript
{
  id: "backup-db",
  name: "Backup Database",
  description: "Create database backup",
  type: "command",
  config: {
    command: "pg_dump mydb > backup.sql",
    workingDirectory: "/backups",
    environment: {
      PGPASSWORD: "secret"
    }
  }
}
```

#### 2. Script Tasks
Execute JavaScript/TypeScript scripts:

```typescript
{
  id: "process-data",
  name: "Process Data",
  description: "Process incoming data files",
  type: "script",
  config: {
    script: `
      const fs = require('fs');
      const data = fs.readFileSync('input.json');
      const processed = JSON.parse(data);
      // Process data...
      fs.writeFileSync('output.json', JSON.stringify(processed));
    `,
    workingDirectory: "/data"
  }
}
```

#### 3. API Tasks
Make HTTP requests:

```typescript
{
  id: "sync-users",
  name: "Sync Users",
  description: "Sync users from external API",
  type: "api",
  config: {
    url: "https://api.example.com/users",
    method: "GET",
    headers: {
      "Authorization": "Bearer token",
      "Content-Type": "application/json"
    }
  }
}
```

#### 4. File Tasks
File system operations:

```typescript
{
  id: "cleanup-logs",
  name: "Cleanup Logs",
  description: "Remove old log files",
  type: "file",
  config: {
    filePath: "/var/logs",
    operation: "cleanup",
    pattern: "*.log",
    maxAge: "7d"
  }
}
```

### Task Dependencies

Tasks can depend on other tasks:

```typescript
{
  id: "send-report",
  name: "Send Report",
  description: "Send generated report via email",
  type: "api",
  dependencies: ["generate-report", "validate-data"],
  config: {
    url: "https://api.email.com/send",
    method: "POST",
    body: {
      to: "admin@company.com",
      subject: "Daily Report",
      attachment: "report.pdf"
    }
  }
}
```

**Dependency Rules:**
- Tasks with dependencies wait for all dependencies to complete successfully
- If any dependency fails, dependent tasks are skipped
- Circular dependencies are detected and prevented
- Tasks without dependencies can run in parallel

## 🚀 Agent Execution

### Execution Flow

1. **Validation**: Agent configuration is validated
2. **Dependency Resolution**: Task dependencies are resolved
3. **Execution Planning**: Tasks are ordered for execution
4. **Task Execution**: Tasks are executed in order
5. **Result Collection**: Results are collected and stored
6. **Status Update**: Agent status is updated

### Execution Modes

#### Normal Execution
```bash
crush agent run <agent-id>
```

#### Dry Run Mode
```bash
crush agent run <agent-id> --dry-run
```
Shows what would be executed without actually running tasks.

#### Watch Mode
```bash
crush agent run <agent-id> --watch
```
Continuously monitors for changes and re-runs the agent.

### Execution Context

Each agent runs in an isolated context:

- **Working Directory**: Configurable base directory
- **Environment Variables**: Agent-specific environment
- **Resource Limits**: Memory and CPU constraints
- **Timeout**: Maximum execution time
- **Process Isolation**: Separate process for each task

## 📊 Monitoring and Results

### Task Results

Each task execution produces a result:

```typescript
interface TaskResult {
  readonly taskId: string;
  readonly status: "success" | "failure" | "skipped";
  readonly output?: string;
  readonly error?: string;
  readonly duration: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
```

### Agent Results

Agent execution produces an aggregate result:

```typescript
interface AgentResult {
  readonly agentId: string;
  readonly status: "success" | "failure" | "partial";
  readonly taskResults: readonly TaskResult[];
  readonly duration: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}
```

### Status Monitoring

Monitor agent status:

```bash
# Get current agent status
crush agent get <agent-id>

# List all agents with status
crush agent list
```

## 🔧 Best Practices

### Agent Design

1. **Single Responsibility**: Each agent should have one clear purpose
2. **Idempotent**: Agents should be safe to run multiple times
3. **Fault Tolerant**: Handle errors gracefully with retries
4. **Resource Efficient**: Use appropriate timeouts and resource limits
5. **Well Documented**: Clear descriptions and task names

### Task Organization

1. **Logical Grouping**: Group related tasks in the same agent
2. **Dependency Management**: Minimize dependencies for better performance
3. **Error Handling**: Each task should handle its own errors
4. **Output Management**: Use structured output for better monitoring
5. **Resource Cleanup**: Clean up resources after task completion

### Configuration Management

1. **Environment Variables**: Use environment variables for sensitive data
2. **Timeout Settings**: Set appropriate timeouts for each task type
3. **Retry Policies**: Use exponential backoff for network operations
4. **Resource Limits**: Set memory and CPU limits for long-running tasks
5. **Logging**: Enable appropriate logging levels for debugging

## 🚧 Planned Features

### Scheduling

Future versions will support:

```typescript
interface Schedule {
  readonly type: "cron" | "interval" | "once";
  readonly value: string | number;
  readonly timezone?: string;
  readonly enabled: boolean;
}
```

**Examples:**
- Cron expressions: `"0 2 * * *"` (daily at 2 AM)
- Intervals: `3600000` (every hour)
- One-time: `"2024-12-31T23:59:59Z"`

### Triggers

Agents will support various triggers:

- **Schedule**: Time-based execution
- **File**: File system changes
- **Webhook**: HTTP requests
- **Event**: Custom events
- **Manual**: User-initiated

### Advanced Features

- **Conditional Execution**: Run tasks based on conditions
- **Parallel Execution**: Execute independent tasks in parallel
- **Resource Monitoring**: Monitor CPU, memory, and disk usage
- **Notification System**: Send notifications on completion/failure
- **Audit Logging**: Track all agent operations

## 📚 Examples

### Backup Agent

```bash
# Create a backup agent
crush agent create backup-agent \
  --description "Daily database backup agent" \
  --timeout 1800000 \
  --max-retries 3 \
  --retry-delay 5000 \
  --retry-backoff exponential
```

**Tasks:**
1. Create backup directory
2. Dump database
3. Compress backup
4. Upload to cloud storage
5. Clean up old backups
6. Send notification

### Data Processing Agent

```bash
# Create a data processing agent
crush agent create data-processor \
  --description "Process incoming data files" \
  --timeout 3600000 \
  --max-retries 2
```

**Tasks:**
1. Monitor input directory
2. Validate data format
3. Transform data
4. Load into database
5. Generate reports
6. Archive processed files

### API Monitoring Agent

```bash
# Create an API monitoring agent
crush agent create api-monitor \
  --description "Monitor API health and performance" \
  --timeout 300000 \
  --max-retries 5 \
  --retry-delay 1000
```

**Tasks:**
1. Health check endpoint
2. Performance metrics collection
3. Error rate monitoring
4. Alert on failures
5. Generate status report

## 🔗 Related Documentation

- [CLI Reference](cli-reference.md) - Command-line interface documentation
- [Architecture Overview](architecture.md) - System architecture and design
- [Task Types](task-types.md) - Detailed task type documentation
- [Configuration](configuration.md) - Configuration options and file format
- [Examples](examples.md) - Practical usage examples

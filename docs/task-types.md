# Task Types Reference

This document provides detailed information about all available task types in Crush, their configuration options, and usage examples.

## 📋 Overview

Tasks are the fundamental building blocks of agents in Crush. Each task represents a single unit of work that can be executed by an agent. Tasks are:

- **Typed**: Each task has a specific type with its own configuration schema
- **Configurable**: Support various options for customization
- **Dependency-aware**: Can depend on other tasks
- **Retryable**: Support individual retry policies
- **Monitored**: Execution results are tracked and stored

## 🏗️ Task Structure

### Core Properties

Every task has these essential properties:

```typescript
interface Task {
  readonly id: string; // Unique identifier
  readonly name: string; // Human-readable name
  readonly description: string; // Purpose description
  readonly type: TaskType; // Task type
  readonly config: TaskConfig; // Type-specific configuration
  readonly dependencies?: readonly string[]; // Task dependencies
  readonly retryCount?: number; // Current retry count
  readonly maxRetries?: number; // Maximum retry attempts
}
```

### Task Types

Crush supports the following task types:

- `command` - Execute shell commands
- `script` - Execute JavaScript/TypeScript code
- `api` - Make HTTP requests
- `file` - File system operations
- `webhook` - Webhook handling (planned)
- `custom` - Custom task implementations (planned)

## 💻 Command Tasks

Execute shell commands in a controlled environment.

### Configuration

```typescript
interface CommandTaskConfig {
  readonly command: string; // Shell command to execute
  readonly workingDirectory?: string; // Working directory
  readonly environment?: Record<string, string>; // Environment variables
  readonly timeout?: number; // Command timeout
  readonly shell?: string; // Shell to use (default: /bin/sh)
}
```

### Examples

#### Basic Command

```typescript
{
  id: "list-files",
  name: "List Files",
  description: "List files in current directory",
  type: "command",
  config: {
    command: "ls -la"
  }
}
```

#### Command with Working Directory

```typescript
{
  id: "backup-database",
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

#### Command with Timeout

```typescript
{
  id: "long-running-process",
  name: "Long Running Process",
  description: "Execute long-running process with timeout",
  type: "command",
  config: {
    command: "python long_script.py",
    timeout: 300000, // 5 minutes
    workingDirectory: "/scripts"
  }
}
```

### Best Practices

1. **Use absolute paths** when possible
2. **Set appropriate timeouts** for long-running commands
3. **Use environment variables** for sensitive data
4. **Validate command output** in dependent tasks
5. **Handle command failures** gracefully

## 📜 Script Tasks

Execute JavaScript or TypeScript code within the agent runtime.

### Configuration

```typescript
interface ScriptTaskConfig {
  readonly script: string; // JavaScript/TypeScript code
  readonly workingDirectory?: string; // Working directory
  readonly environment?: Record<string, string>; // Environment variables
  readonly timeout?: number; // Script timeout
  readonly language?: "javascript" | "typescript"; // Script language
}
```

### Examples

#### Data Processing Script

```typescript
{
  id: "process-data",
  name: "Process Data",
  description: "Process incoming data files",
  type: "script",
  config: {
    script: `
      const fs = require('fs');
      const path = require('path');

      // Read input data
      const inputPath = path.join(process.cwd(), 'input.json');
      const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

      // Process data
      const processed = data.map(item => ({
        ...item,
        processed: true,
        timestamp: new Date().toISOString()
      }));

      // Write output
      const outputPath = path.join(process.cwd(), 'output.json');
      fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));

      console.log(\`Processed \${processed.length} items\`);
    `,
    workingDirectory: "/data"
  }
}
```

#### API Integration Script

```typescript
{
  id: "fetch-data",
  name: "Fetch Data",
  description: "Fetch data from external API",
  type: "script",
  config: {
    script: `
      const https = require('https');

      const options = {
        hostname: 'api.example.com',
        port: 443,
        path: '/data',
        method: 'GET',
        headers: {
          'Authorization': \`Bearer \${process.env.API_TOKEN}\`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const result = JSON.parse(data);
          console.log(\`Fetched \${result.items.length} items\`);

          // Save to file
          require('fs').writeFileSync('api-data.json', data);
        });
      });

      req.on('error', (error) => {
        console.error('API request failed:', error);
        process.exit(1);
      });

      req.end();
    `,
    environment: {
      API_TOKEN: "your-api-token"
    }
  }
}
```

### Available Modules

Script tasks have access to Node.js built-in modules:

- `fs` - File system operations
- `path` - Path manipulation
- `http`/`https` - HTTP requests
- `crypto` - Cryptographic functions
- `util` - Utility functions
- `os` - Operating system information
- `child_process` - Process spawning

### Best Practices

1. **Use async/await** for better error handling
2. **Validate inputs** before processing
3. **Handle errors** with try-catch blocks
4. **Use environment variables** for configuration
5. **Log progress** for debugging

## 🌐 API Tasks

Make HTTP requests to external APIs or services.

### Configuration

```typescript
interface ApiTaskConfig {
  readonly url: string; // Request URL
  readonly method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"; // HTTP method
  readonly headers?: Record<string, string>; // Request headers
  readonly body?: unknown; // Request body
  readonly timeout?: number; // Request timeout
  readonly followRedirects?: boolean; // Follow redirects
  readonly validateSSL?: boolean; // Validate SSL certificates
}
```

### Examples

#### GET Request

```typescript
{
  id: "health-check",
  name: "Health Check",
  description: "Check API health status",
  type: "api",
  config: {
    url: "https://api.example.com/health",
    method: "GET",
    headers: {
      "User-Agent": "Crush-Agent/1.0"
    },
    timeout: 30000
  }
}
```

#### POST Request with Body

```typescript
{
  id: "create-user",
  name: "Create User",
  description: "Create new user via API",
  type: "api",
  config: {
    url: "https://api.example.com/users",
    method: "POST",
    headers: {
      "Authorization": "Bearer ${API_TOKEN}",
      "Content-Type": "application/json"
    },
    body: {
      name: "John Doe",
      email: "john@example.com",
      role: "user"
    }
  }
}
```

#### File Upload

```typescript
{
  id: "upload-file",
  name: "Upload File",
  description: "Upload file to cloud storage",
  type: "api",
  config: {
    url: "https://storage.example.com/upload",
    method: "POST",
    headers: {
      "Authorization": "Bearer ${STORAGE_TOKEN}",
      "Content-Type": "multipart/form-data"
    },
    body: {
      file: "@/path/to/file.txt",
      metadata: {
        name: "backup.txt",
        type: "text/plain"
      }
    }
  }
}
```

### Response Handling

API tasks automatically handle:

- **Status Codes**: Success (2xx), Client Error (4xx), Server Error (5xx)
- **Response Parsing**: JSON, XML, plain text
- **Error Handling**: Network errors, timeouts, invalid responses
- **Retry Logic**: Automatic retries for transient failures

### Best Practices

1. **Use HTTPS** for secure communications
2. **Set appropriate timeouts** for network requests
3. **Handle authentication** properly
4. **Validate responses** before processing
5. **Use retry policies** for unreliable APIs

## 📁 File Tasks

Perform file system operations and file management.

### Configuration

```typescript
interface FileTaskConfig {
  readonly filePath: string; // Target file or directory path
  readonly operation:
    | "read"
    | "write"
    | "copy"
    | "move"
    | "delete"
    | "list"
    | "watch"; // Operation type
  readonly content?: string; // Content for write operations
  readonly destination?: string; // Destination for copy/move operations
  readonly pattern?: string; // File pattern for list operations
  readonly recursive?: boolean; // Recursive operations
  readonly createDirectories?: boolean; // Create directories if needed
}
```

### Examples

#### Read File

```typescript
{
  id: "read-config",
  name: "Read Configuration",
  description: "Read application configuration file",
  type: "file",
  config: {
    filePath: "/etc/app/config.json",
    operation: "read"
  }
}
```

#### Write File

```typescript
{
  id: "write-log",
  name: "Write Log",
  description: "Write log entry to file",
  type: "file",
  config: {
    filePath: "/var/log/app.log",
    operation: "write",
    content: `${new Date().toISOString()} - Application started\n`,
    createDirectories: true
  }
}
```

#### Copy Files

```typescript
{
  id: "backup-files",
  name: "Backup Files",
  description: "Backup important files",
  type: "file",
  config: {
    filePath: "/var/www/html",
    operation: "copy",
    destination: "/backups/html-backup",
    recursive: true
  }
}
```

#### List Files

```typescript
{
  id: "list-logs",
  name: "List Log Files",
  description: "List all log files in directory",
  type: "file",
  config: {
    filePath: "/var/log",
    operation: "list",
    pattern: "*.log",
    recursive: true
  }
}
```

#### Delete Files

```typescript
{
  id: "cleanup-temp",
  name: "Cleanup Temp Files",
  description: "Remove temporary files",
  type: "file",
  config: {
    filePath: "/tmp",
    operation: "delete",
    pattern: "*.tmp",
    recursive: true
  }
}
```

### Best Practices

1. **Use absolute paths** for reliability
2. **Check file permissions** before operations
3. **Handle file locks** gracefully
4. **Use patterns** for bulk operations
5. **Backup important files** before modifications

## 🔗 Webhook Tasks (Planned)

Handle incoming webhook requests and trigger actions.

### Configuration

```typescript
interface WebhookTaskConfig {
  readonly endpoint: string; // Webhook endpoint path
  readonly method?: string; // HTTP method to accept
  readonly secret?: string; // Webhook secret for validation
  readonly timeout?: number; // Request timeout
  readonly maxPayloadSize?: number; // Maximum payload size
}
```

### Examples

#### GitHub Webhook

```typescript
{
  id: "github-webhook",
  name: "GitHub Webhook Handler",
  description: "Handle GitHub push events",
  type: "webhook",
  config: {
    endpoint: "/webhooks/github",
    method: "POST",
    secret: "${GITHUB_WEBHOOK_SECRET}",
    timeout: 30000
  }
}
```

## 🎯 Custom Tasks (Planned)

Implement custom task types for specific use cases.

### Configuration

```typescript
interface CustomTaskConfig {
  readonly plugin: string; // Plugin name
  readonly config: Record<string, unknown>; // Plugin-specific configuration
}
```

## 🔄 Task Dependencies

Tasks can depend on other tasks to create execution workflows.

### Dependency Rules

1. **Execution Order**: Dependencies are executed before dependent tasks
2. **Failure Handling**: If a dependency fails, dependent tasks are skipped
3. **Parallel Execution**: Tasks without dependencies can run in parallel
4. **Circular Dependencies**: Detected and prevented during validation

### Examples

#### Sequential Tasks

```typescript
// Task 1: Fetch data
{
  id: "fetch-data",
  name: "Fetch Data",
  type: "api",
  config: { url: "https://api.example.com/data" }
}

// Task 2: Process data (depends on fetch-data)
{
  id: "process-data",
  name: "Process Data",
  type: "script",
  dependencies: ["fetch-data"],
  config: { script: "// Process the fetched data" }
}

// Task 3: Save results (depends on process-data)
{
  id: "save-results",
  name: "Save Results",
  type: "file",
  dependencies: ["process-data"],
  config: { filePath: "/results/output.json", operation: "write" }
}
```

#### Parallel Tasks

```typescript
// These tasks can run in parallel (no dependencies)
{
  id: "backup-database",
  name: "Backup Database",
  type: "command",
  config: { command: "pg_dump mydb > backup.sql" }
}

{
  id: "backup-files",
  name: "Backup Files",
  type: "file",
  config: { filePath: "/var/www", operation: "copy", destination: "/backups" }
}

// This task waits for both backups to complete
{
  id: "notify-completion",
  name: "Notify Completion",
  type: "api",
  dependencies: ["backup-database", "backup-files"],
  config: { url: "https://api.example.com/notify", method: "POST" }
}
```

## ⚙️ Task Configuration

### Retry Policies

Tasks can have individual retry policies:

```typescript
{
  id: "unreliable-api",
  name: "Unreliable API Call",
  type: "api",
  maxRetries: 5,
  config: {
    url: "https://unreliable-api.com/data",
    timeout: 10000
  }
}
```

### Timeouts

Set individual timeouts for tasks:

```typescript
{
  id: "long-script",
  name: "Long Running Script",
  type: "script",
  config: {
    script: "// Long running operation",
    timeout: 600000 // 10 minutes
  }
}
```

### Environment Variables

Tasks inherit agent environment variables and can have their own:

```typescript
{
  id: "api-call",
  name: "API Call",
  type: "api",
  config: {
    url: "https://api.example.com/data",
    headers: {
      "Authorization": "Bearer ${API_TOKEN}"
    }
  }
}
```

## 📊 Task Results

### Result Structure

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

### Success Result

```typescript
{
  taskId: "backup-database",
  status: "success",
  output: "Database backup completed successfully",
  duration: 15000,
  timestamp: new Date("2024-01-15T10:30:00Z"),
  metadata: {
    backupSize: "2.5MB",
    recordsBackedUp: 1500
  }
}
```

### Failure Result

```typescript
{
  taskId: "api-call",
  status: "failure",
  error: "Connection timeout after 30 seconds",
  duration: 30000,
  timestamp: new Date("2024-01-15T10:30:00Z"),
  metadata: {
    retryCount: 3,
    lastAttempt: true
  }
}
```

## 🔧 Best Practices

### Task Design

1. **Single Responsibility**: Each task should do one thing well
2. **Idempotent**: Tasks should be safe to run multiple times
3. **Fault Tolerant**: Handle errors gracefully
4. **Resource Efficient**: Use appropriate timeouts and limits
5. **Well Documented**: Clear names and descriptions

### Performance

1. **Minimize Dependencies**: Reduce dependency chains for better performance
2. **Use Parallel Execution**: Run independent tasks in parallel
3. **Optimize Timeouts**: Set appropriate timeouts for each task type
4. **Resource Management**: Clean up resources after task completion
5. **Error Handling**: Implement proper error handling and recovery

### Security

1. **Input Validation**: Validate all inputs before processing
2. **Secure Credentials**: Use environment variables for sensitive data
3. **Path Security**: Prevent path traversal attacks
4. **Network Security**: Use HTTPS for API calls
5. **Access Control**: Implement proper access controls

## 📚 Related Documentation

- [Agent Development](agent-development.md) - Creating and managing agents
- [CLI Reference](cli-reference.md) - Command-line interface
- [Architecture Overview](architecture.md) - System architecture
- [Examples](examples.md) - Practical usage examples

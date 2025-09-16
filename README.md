# Crush 🚀

A powerful agentic automation CLI built with for managing agentic loops in daily life workflows.

[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Overview

Crush is a command-line tool designed to help you create, manage, and execute autonomous agents that can perform complex automation tasks.

### Key Features

- **🤖 Agent Management**: Create, configure, and manage autonomous agents
- **⚡ Task Execution**: Execute various types of tasks (commands, scripts, API calls, file operations)
- **🔄 Automation**: Schedule and trigger agent executions
- **📊 Monitoring**: Track agent performance and execution results
- **🛡️ Type Safety**: Full TypeScript support with strict type checking
- **🔧 Extensible**: Plugin system for custom task types and integrations
- **📝 Structured Logging**: Comprehensive logging with correlation IDs

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- Bun (recommended) or npm/yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/lvndry/crush.git
cd crush

# Install dependencies
bun install

# Build the project
bun run build

# Install globally (optional)
bun run build && npm link

# Alternative: Run directly without global installation
bun run src/main.ts
```

### Basic Usage

> [!TIP]
> If you haven't installed `crush` globally with `npm link`, you can run commands directly using: `bun run src/main.ts` from the root of the repository.

```bash
# Create your first agent
crush agent create my-agent --description "My first automation agent"

# List all agents
crush agent list

# Get agent details
crush agent get <agent-id>

# Run an agent (dry run)
crush agent run <agent-id> --dry-run

# Delete an agent
crush agent delete <agent-id>
```

## ⚙️ Configuration

Crush uses a JSON configuration file to manage application settings, API keys, and service integrations. The configuration system provides sensible defaults while allowing full customization.

### Configuration File Location

Crush looks for configuration files in the following order:

1. **Environment Variable**: `CRUSH_CONFIG_PATH` (if set)
2. **Current Directory**: `./crush.config.json`
3. **Home Directory**: `~/.crush/config.json`

### Basic Configuration

Create a `crush.config.json` file in your project root or home directory:

```json
{
  "google": {
    "clientId": "your-google-client-id.apps.googleusercontent.com",
    "clientSecret": "your-google-client-secret"
  },
  "llm": {
    "defaultProvider": "openai",
    "openai": {
      "api_key": "sk-your-openai-api-key"
    },
    "anthropic": {
      "api_key": "sk-ant-your-anthropic-api-key"
    }
  }
}
```

### Configuration Sections

#### 🔐 Google OAuth (Optional)

Required for Gmail integration and Google services:

```json
{
  "google": {
    "clientId": "your-client-id.apps.googleusercontent.com",
    "clientSecret": "your-client-secret"
  }
}
```

**Setup Instructions:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:53682/oauth2callback` as redirect URI
6. Copy client ID and secret to your config

#### 🤖 LLM Providers

Configure language model providers for AI agents:

```json
{
  "llm": {
    "defaultProvider": "openai",
    "openai": {
      "api_key": "sk-your-openai-api-key"
    },
    "anthropic": {
      "api_key": "sk-ant-your-anthropic-api-key"
    },
    "google": {
      "api_key": "AIza-your-google-api-key"
    },
    "mistral": {
      "api_key": "mist-your-mistral-api-key"
    }
  }
}
```

#### 📁 Storage (Optional)

Customize where Crush stores data:

```json
{
  "storage": {
    "type": "file",
    "path": "./.crush"
  }
}
```

**Default**: `./.crush`

#### 📊 Logging (Optional)

Configure logging behavior:

```json
{
  "logging": {
    "level": "info",
    "format": "pretty",
    "output": "console"
  }
}
```

**Options:**

- `level`: `debug`, `info`, `warn`, `error`
- `format`: `pretty`, `json`
- `output`: `console`, `file`

### Authentication Management

Crush provides built-in authentication management for services:

```bash
# Authenticate with Gmail
crush auth gmail login

# Check authentication status
crush auth gmail status

# Logout from Gmail
crush auth gmail logout
```

**Token Storage**: Authentication tokens are automatically stored in `.crush/google/gmail-token.json` and managed securely by Crush.

### Environment Variables

You can also use environment variables instead of the config file:

```bash
# Google OAuth
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"

# LLM API Keys
export OPENAI_API_KEY="sk-your-openai-key"
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"

# Configuration
export CRUSH_CONFIG_PATH="/path/to/your/config.json"
```

### Configuration Validation

Crush validates your configuration on startup and provides helpful error messages for missing or invalid settings. Check the logs for configuration issues:

```bash
# Run with verbose logging to see configuration details
crush --verbose agent list
```

## 📖 Documentation

- [Architecture Overview](docs/architecture.md) - Understanding the system design
- [CLI Reference](docs/cli-reference.md) - Complete command documentation
- [Agent Development](docs/agent-development.md) - Creating and configuring agents
- [Task Types](docs/task-types.md) - Available task types and their usage
- [Configuration](docs/configuration.md) - Application configuration options
- [API Reference](docs/api-reference.md) - Service interfaces and types
- [Examples](docs/examples.md) - Practical usage examples
- [Contributing](docs/contributing.md) - Development guidelines

## 🏗️ Architecture

Crush is built using a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│                CLI Layer                │
│         (Commands & User Interface)     │
├─────────────────────────────────────────┤
│              Core Layer                 │
│        (Business Logic & Services)      │
├─────────────────────────────────────────┤
│            Services Layer               │
│    (Storage, Logging, Configuration)    │
├─────────────────────────────────────────┤
│           Effect-TS Runtime             │
│      (Functional Programming Layer)     │
└─────────────────────────────────────────┘
```

### Core Components

- **Agent Service**: Manages agent lifecycle and operations
- **Storage Service**: Handles persistence (file-based and in-memory)
- **Configuration Service**: Manages application settings
- **Logging Service**: Structured logging with Effect's Logger
- **CLI Commands**: User interface for all operations

## 🛠️ Development

### Project Structure

```
src/
├── cli/                    # CLI commands and user interface
│   └── commands/
│       └── agent.ts       # Agent management commands
├── core/                   # Core business logic
│   ├── agent/             # Agent service and types
│   ├── automation/        # Automation logic (planned)
│   ├── config/            # Configuration types (planned)
│   └── types/             # Core type definitions
├── services/              # Infrastructure services
│   ├── config.ts          # Configuration service
│   ├── logger.ts          # Logging service
│   └── storage.ts         # Storage service
└── main.ts                # Application entry point
```

### Development Commands

```bash
# Development with hot reload
bun run dev

# Build the project
bun run build

# Run linting
bun run lint

# Fix linting issues
bun run lint:fix

# Format code
bun run format

# Run tests
bun test

# Run tests in watch mode
bun run test:watch

# Clean build artifacts
bun run clean
```

## 📋 Current Status

[TODO.md](./TODO.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/lvndry/crush/issues)
- 💬 [Discussions](https://github.com/lvndry/crush/discussions)

---

**Built with ❤️ by [lvndry](https://github.com/lvndry)**

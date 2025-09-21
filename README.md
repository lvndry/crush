# Jazz 🎷

A powerful agentic automation CLI built with for managing agentic loops in daily life workflows.

[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Overview

Jazz is a command-line tool designed to help you create, manage, and execute autonomous agents that can perform complex automation tasks.

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
git clone https://github.com/lvndry/jazz.git
cd jazz

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
> If you haven't installed `jazz` globally with `npm link`, you can run commands directly using: `bun run src/main.ts` from the root of the repository.

```bash
# Create your first agent
jazz agent create

# List all agents
jazz agent list

# Get agent details
jazz agent get <agent-id>

# Run an agent (dry run)
jazz agent run <agent-id> --dry-run

# Delete an agent
jazz agent delete <agent-id>
```

## ⚙️ Configuration

Jazz uses a JSON configuration file to manage application settings, API keys, and service integrations. The configuration system provides sensible defaults while allowing full customization.

### Configuration File Location

Jazz looks for configuration files in the following order:

1. **Environment Variable**: `JAZZ_CONFIG_PATH` (if set)
2. **Current Directory**: `./jazz.config.json`
3. **Home Directory**: `~/.jazz/config.json`

### Basic Configuration

Create a `jazz.config.json` file in your project root or home directory:

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

Configure model providers for AI agents:

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

### Authentication Management

Jazz provides built-in authentication management for services:

```bash
# Authenticate with Gmail
jazz auth gmail login

# Check authentication status
jazz auth gmail status

# Logout from Gmail
jazz auth gmail logout
```

**Token Storage**: Authentication tokens are automatically stored in `.jazz/google/gmail-token.json` and managed securely by Jazz.

```bash
# Run with verbose logging to see configuration details
jazz --verbose agent list
```

## 📖 Documentation

- [Architecture Overview](docs/architecture.md) - Understanding the system design
- [CLI Reference](docs/cli-reference.md) - Complete command documentation
- [Agent Development](docs/agent-development.md) - Creating and configuring agents
- [Task Types](docs/task-types.md) - Available task types and their usage
- [Configuration](docs/configuration.md) - Application configuration options
- [API Reference](docs/api-reference.md) - Service interfaces and types
- [Examples](docs/examples.md) - Practical usage examples
- [Contributing](CONTRIBUTING.md) - Development guidelines

## 📋 Current Status

[TODO.md](./TODO.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/lvndry/jazz/issues)
- 💬 [Discussions](https://github.com/lvndry/jazz/discussions)

---

**Built with ❤️ by [lvndry](https://github.com/lvndry)**

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
git clone https://github.com/your-username/crush.git
cd crush

# Install dependencies
bun install

# Build the project
bun run build

# Install globally (optional)
bun run build && npm link
```

### Basic Usage

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

### ✅ Implemented

- [x] Project bootstrap with TypeScript + Effect-TS
- [x] Core type definitions and interfaces
- [x] Effect layers for services (logging, config, storage)
- [x] CLI framework with Commander.js
- [x] Error handling with tagged errors
- [x] Agent CRUD operations
- [x] File-based and in-memory storage
- [x] Basic CLI commands for agent management

### 🔄 In Progress

- [ ] Agent execution engine
- [ ] Task execution framework
- [ ] MCP (Model Context Protocol) integration
- [ ] Automation and scheduling system

### 📋 Planned

- [ ] Advanced task types (API, file operations, webhooks)
- [ ] Monitoring and observability features
- [ ] Plugin system for extensibility
- [ ] Interactive CLI commands
- [ ] Comprehensive testing suite

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Effect-TS](https://effect.website/) - The functional programming library that powers this project
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety and developer experience

## 📞 Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/your-username/crush/issues)
- 💬 [Discussions](https://github.com/your-username/crush/discussions)

---

**Built with ❤️ by [lvndry](https://github.com/lvndry)**

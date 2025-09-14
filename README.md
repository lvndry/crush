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

**Note**: If you haven't installed globally with `npm link`, you can run commands directly using:
```bash
bun run src/main.ts --help
```

```bash
# Create your first agent
crush agent create my-agent --description "My first automation agent"
# OR if not installed globally:
bun run src/main.ts agent create my-agent --description "My first automation agent"

# List all agents
crush agent list
# OR if not installed globally:
bun run src/main.ts agent list

# Get agent details
crush agent get <agent-id>
# OR if not installed globally:
bun run src/main.ts agent get <agent-id>

# Run an agent (dry run)
crush agent run <agent-id> --dry-run
# OR if not installed globally:
bun run src/main.ts agent run <agent-id> --dry-run

# Delete an agent
crush agent delete <agent-id>
# OR if not installed globally:
bun run src/main.ts agent delete <agent-id>
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

## 🙏 Acknowledgments

- [Effect-TS](https://effect.website/) - The functional programming library that powers this project
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety and developer experience

## 📞 Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/lvndry/crush/issues)
- 💬 [Discussions](https://github.com/lvndry/crush/discussions)

---

**Built with ❤️ by [lvndry](https://github.com/lvndry)**

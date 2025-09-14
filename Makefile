# Crush CLI Makefile
# Provides convenient commands for development, building, and testing

.PHONY: help install build dev test test-watch lint lint-fix format clean start cli install-global uninstall-global

# Default target
help: ## Show this help message
	@echo "Crush CLI - Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Installation and setup
install: ## Install dependencies
	@echo "Installing dependencies..."
	bun install

install-global: build ## Install Crush globally
	@echo "Installing Crush globally..."
	npm link

uninstall-global: ## Uninstall Crush globally
	@echo "Uninstalling Crush globally..."
	npm unlink -g crush

# Development
dev: ## Start development server with hot reload
	@echo "Starting development server..."
	bun --watch src/main.ts

start: ## Start the built application
	@echo "Starting Crush CLI..."
	bun dist/main.js

cli: ## Run CLI directly from source
	@echo "Running CLI from source..."
	bun src/main.ts

# Building
build: clean ## Build the project
	@echo "Building Crush CLI..."
	bun run build

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	bun run clean

# Testing
test: ## Run tests
	@echo "Running tests..."
	bun test

test-watch: ## Run tests in watch mode
	@echo "Running tests in watch mode..."
	bun run test:watch

# Code quality
lint: ## Run linting
	@echo "Running linter..."
	bun run lint

lint-fix: ## Fix linting issues
	@echo "Fixing linting issues..."
	bun run lint:fix

format: ## Format code
	@echo "Formatting code..."
	bun run format

# Development workflow
check: lint test ## Run linting and tests
	@echo "All checks passed!"

pre-commit: format lint-fix test ## Run pre-commit checks
	@echo "Pre-commit checks completed!"

# Agent management (examples)
agent-list: ## List all agents
	@echo "Listing agents..."
	bun src/main.ts agent list

agent-create: ## Create a test agent
	@echo "Creating test agent..."
	bun src/main.ts agent create test-agent --description "Test agent created via Makefile"

agent-clean: ## Clean up test agents
	@echo "Cleaning up test agents..."
	@echo "Note: This would delete test agents (not implemented yet)"

# Documentation
docs-serve: ## Serve documentation locally (requires mkdocs)
	@echo "Serving documentation..."
	@if command -v mkdocs >/dev/null 2>&1; then \
		mkdocs serve; \
	else \
		echo "MkDocs not installed. Install with: pip install mkdocs"; \
	fi

docs-build: ## Build documentation
	@echo "Building documentation..."
	@if command -v mkdocs >/dev/null 2>&1; then \
		mkdocs build; \
	else \
		echo "MkDocs not installed. Install with: pip install mkdocs"; \
	fi

# Release
release-check: check ## Check if ready for release
	@echo "Checking release readiness..."
	@echo "Version: $$(grep '"version"' package.json | cut -d'"' -f4)"
	@echo "Build status: $$(if [ -d dist ]; then echo "Built"; else echo "Not built"; fi)"
	@echo "Tests: $$(if bun test >/dev/null 2>&1; then echo "Passing"; else echo "Failing"; fi)"

release-build: clean build test ## Build release version
	@echo "Building release version..."
	@echo "Release build completed!"

# Docker
docker-build: ## Build Docker image
	@echo "Building Docker image..."
	@if [ -f Dockerfile ]; then \
		docker build -t crush:latest .; \
	else \
		echo "Dockerfile not found"; \
	fi

docker-run: ## Run Docker container
	@echo "Running Docker container..."
	@if [ -f Dockerfile ]; then \
		docker run -it --rm crush:latest; \
	else \
		echo "Dockerfile not found"; \
	fi

# Environment setup
setup: install ## Complete development setup
	@echo "Setting up development environment..."
	@echo "✅ Dependencies installed"
	@echo "✅ Development environment ready"
	@echo ""
	@echo "Next steps:"
	@echo "  make dev     - Start development server"
	@echo "  make test    - Run tests"
	@echo "  make build   - Build the project"

# CI/CD helpers
ci-install: ## Install dependencies for CI
	@echo "Installing dependencies for CI..."
	bun install --frozen-lockfile

ci-test: ## Run tests for CI
	@echo "Running CI tests..."
	bun test --coverage

ci-build: ## Build for CI
	@echo "Building for CI..."
	bun run build

# Utility commands
version: ## Show version information
	@echo "Crush CLI Version Information:"
	@echo "Package version: $$(grep '"version"' package.json | cut -d'"' -f4)"
	@echo "Node version: $$(node --version)"
	@echo "Bun version: $$(bun --version)"
	@echo "TypeScript version: $$(bunx tsc --version)"

info: ## Show project information
	@echo "Crush CLI Project Information:"
	@echo "Name: $$(grep '"name"' package.json | cut -d'"' -f4)"
	@echo "Description: $$(grep '"description"' package.json | cut -d'"' -f4)"
	@echo "Author: $$(grep '"author"' package.json | cut -d'"' -f4)"
	@echo "License: $$(grep '"license"' package.json | cut -d'"' -f4)"
	@echo "Repository: $$(grep '"repository"' package.json | cut -d'"' -f4 || echo 'Not specified')"

# Cleanup
clean-all: clean ## Clean everything including node_modules
	@echo "Cleaning everything..."
	rm -rf node_modules
	rm -rf dist
	rm -rf .bun
	@echo "Complete cleanup finished!"

# Development helpers
watch: ## Watch for changes and rebuild
	@echo "Watching for changes..."
	@if command -v nodemon >/dev/null 2>&1; then \
		nodemon --watch src --ext ts --exec "bun run build"; \
	else \
		echo "Nodemon not installed. Install with: npm install -g nodemon"; \
		echo "Or use: make dev"; \
	fi

# Quick development cycle
quick: format lint-fix build test ## Quick development cycle
	@echo "Quick development cycle completed!"

# Show file structure
tree: ## Show project structure
	@echo "Project structure:"
	@tree -I 'node_modules|dist|.git' -a

# Performance
benchmark: ## Run performance benchmarks
	@echo "Running benchmarks..."
	@if [ -f "benchmarks/" ]; then \
		bun run benchmark; \
	else \
		echo "No benchmarks found"; \
	fi

# Security
audit: ## Run security audit
	@echo "Running security audit..."
	bun audit

# Update dependencies
update: ## Update dependencies
	@echo "Updating dependencies..."
	bun update

update-interactive: ## Update dependencies interactively
	@echo "Updating dependencies interactively..."
	bun update --interactive

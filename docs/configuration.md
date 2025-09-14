# Configuration Guide

This guide explains how to configure Crush, including application settings, environment variables, and configuration files.

## 📋 Overview

Crush uses a hierarchical configuration system that allows you to customize behavior through:

1. **Configuration Files** - JSON/YAML configuration files
2. **Environment Variables** - Runtime configuration overrides
3. **Command Line Options** - Per-command configuration
4. **Default Values** - Built-in sensible defaults

## ⚙️ Configuration Hierarchy

Configuration is applied in the following order (later sources override earlier ones):

```
1. Default Values (built-in)
2. Configuration File (crush.config.json)
3. Environment Variables
4. Command Line Options
```

## 📁 Configuration File

### File Location

Crush looks for configuration files in this order:

1. `./crush.config.json` (current directory)
2. `~/.crush/config.json` (user home directory)
3. `/etc/crush/config.json` (system-wide)

### File Format

Configuration files use JSON format:

```json
{
  "storage": {
    "type": "file",
    "path": "./.crush/data"
  },
  "logging": {
    "level": "info",
    "format": "pretty",
    "output": "console",
    "filePath": "./logs/crush.log"
  },
  "security": {
    "encryptionKey": "your-encryption-key",
    "allowedOrigins": ["http://localhost:3000"],
    "rateLimit": {
      "requests": 100,
      "window": 60000
    }
  },
  "performance": {
    "maxConcurrentAgents": 5,
    "maxConcurrentTasks": 10,
    "timeout": 30000,
    "memoryLimit": 1073741824
  }
}
```

### Configuration Sections

#### Storage Configuration

```json
{
  "storage": {
    "type": "file",
    "path": "./.crush/data"
  }
}
```

**Options:**

- `type` - Storage backend type (`"file"` or `"database"`)
- `path` - Storage directory path (for file storage)
- `connectionString` - Database connection string (for database storage)

#### Logging Configuration

```json
{
  "logging": {
    "level": "info",
    "format": "pretty",
    "output": "console",
    "filePath": "./logs/crush.log"
  }
}
```

**Options:**

- `level` - Log level (`"debug"`, `"info"`, `"warn"`, `"error"`)
- `format` - Log format (`"json"` or `"pretty"`)
- `output` - Output destination (`"console"`, `"file"`, or `"both"`)
- `filePath` - Log file path (when output includes `"file"`)

#### Security Configuration

```json
{
  "security": {
    "encryptionKey": "your-encryption-key",
    "allowedOrigins": ["http://localhost:3000"],
    "rateLimit": {
      "requests": 100,
      "window": 60000
    }
  }
}
```

**Options:**

- `encryptionKey` - Key for encrypting sensitive data
- `allowedOrigins` - Allowed origins for CORS (planned)
- `rateLimit` - Rate limiting configuration
  - `requests` - Maximum requests per window
  - `window` - Time window in milliseconds

#### Performance Configuration

```json
{
  "performance": {
    "maxConcurrentAgents": 5,
    "maxConcurrentTasks": 10,
    "timeout": 30000,
    "memoryLimit": 1073741824
  }
}
```

**Options:**

- `maxConcurrentAgents` - Maximum concurrent agent executions
- `maxConcurrentTasks` - Maximum concurrent task executions
- `timeout` - Default timeout in milliseconds
- `memoryLimit` - Memory limit in bytes

## 🌍 Environment Variables

Environment variables provide runtime configuration overrides.

### Storage Variables

```bash
# Storage configuration
export CRUSH_STORAGE_TYPE="file"
export CRUSH_STORAGE_PATH="/custom/data/path"
export CRUSH_STORAGE_CONNECTION_STRING="postgresql://user:pass@localhost/crush"
```

### Logging Variables

```bash
# Logging configuration
export CRUSH_LOG_LEVEL="debug"
export CRUSH_LOG_FORMAT="json"
export CRUSH_LOG_OUTPUT="both"
export CRUSH_LOG_FILE_PATH="/var/log/crush.log"
```

### Security Variables

```bash
# Security configuration
export CRUSH_ENCRYPTION_KEY="your-secret-key"
export CRUSH_ALLOWED_ORIGINS="http://localhost:3000,https://app.example.com"
export CRUSH_RATE_LIMIT_REQUESTS="200"
export CRUSH_RATE_LIMIT_WINDOW="60000"
```

### Performance Variables

```bash
# Performance configuration
export CRUSH_MAX_CONCURRENT_AGENTS="10"
export CRUSH_MAX_CONCURRENT_TASKS="20"
export CRUSH_TIMEOUT="60000"
export CRUSH_MEMORY_LIMIT="2147483648"
```

### Agent-Specific Variables

```bash
# Agent environment variables
export CRUSH_AGENT_TIMEOUT="300000"
export CRUSH_AGENT_MAX_RETRIES="5"
export CRUSH_AGENT_RETRY_DELAY="2000"
export CRUSH_AGENT_RETRY_BACKOFF="exponential"
```

## 🎯 Command Line Options

### Global Options

All commands support these global options:

```bash
# Verbose logging
crush --verbose agent list

# Quiet mode
crush --quiet agent create my-agent

# Custom config file
crush --config /path/to/config.json agent list
```

### Agent Command Options

```bash
# Create agent with custom timeout
crush agent create my-agent --timeout 60000

# Create agent with retry policy
crush agent create my-agent \
  --max-retries 5 \
  --retry-delay 2000 \
  --retry-backoff exponential

# Run agent with options
crush agent run <agent-id> --dry-run --watch
```

## 🔧 Configuration Examples

### Development Configuration

For development environments:

```json
{
  "storage": {
    "type": "file",
    "path": "./dev-data"
  },
  "logging": {
    "level": "debug",
    "format": "pretty",
    "output": "console"
  },
  "performance": {
    "maxConcurrentAgents": 2,
    "maxConcurrentTasks": 5,
    "timeout": 10000
  }
}
```

### Production Configuration

For production environments:

```json
{
  "storage": {
    "type": "file",
    "path": "/var/lib/crush/data"
  },
  "logging": {
    "level": "info",
    "format": "json",
    "output": "both",
    "filePath": "/var/log/crush/crush.log"
  },
  "security": {
    "encryptionKey": "${CRUSH_ENCRYPTION_KEY}",
    "rateLimit": {
      "requests": 1000,
      "window": 60000
    }
  },
  "performance": {
    "maxConcurrentAgents": 10,
    "maxConcurrentTasks": 50,
    "timeout": 300000,
    "memoryLimit": 2147483648
  }
}
```

### Testing Configuration

For testing environments:

```json
{
  "storage": {
    "type": "file",
    "path": "./test-data"
  },
  "logging": {
    "level": "error",
    "format": "json",
    "output": "file",
    "filePath": "./test-logs/crush.log"
  },
  "performance": {
    "maxConcurrentAgents": 1,
    "maxConcurrentTasks": 2,
    "timeout": 5000
  }
}
```

## 🔐 Security Configuration

### Encryption

Configure encryption for sensitive data:

```json
{
  "security": {
    "encryptionKey": "your-32-character-secret-key"
  }
}
```

**Best Practices:**

- Use a strong, random 32-character key
- Store the key securely (environment variables, key management systems)
- Rotate keys regularly
- Never commit keys to version control

### Rate Limiting

Configure rate limiting to prevent abuse:

```json
{
  "security": {
    "rateLimit": {
      "requests": 100,
      "window": 60000
    }
  }
}
```

**Options:**

- `requests` - Maximum requests allowed per window
- `window` - Time window in milliseconds

### CORS Configuration (Planned)

Configure Cross-Origin Resource Sharing:

```json
{
  "security": {
    "allowedOrigins": [
      "http://localhost:3000",
      "https://app.example.com",
      "https://admin.example.com"
    ]
  }
}
```

## 📊 Performance Tuning

### Concurrency Limits

Adjust concurrency based on your system resources:

```json
{
  "performance": {
    "maxConcurrentAgents": 5,
    "maxConcurrentTasks": 10
  }
}
```

**Guidelines:**

- **CPU-bound tasks**: Set limits based on CPU cores
- **I/O-bound tasks**: Can handle higher concurrency
- **Memory-intensive tasks**: Consider memory usage
- **Network tasks**: Consider bandwidth limitations

### Timeout Configuration

Set appropriate timeouts for different scenarios:

```json
{
  "performance": {
    "timeout": 30000
  }
}
```

**Timeout Guidelines:**

- **Quick tasks**: 5-30 seconds
- **Medium tasks**: 1-10 minutes
- **Long tasks**: 10-60 minutes
- **Maximum**: 1 hour (3600000ms)

### Memory Limits

Configure memory limits to prevent resource exhaustion:

```json
{
  "performance": {
    "memoryLimit": 1073741824
  }
}
```

**Memory Guidelines:**

- **Small systems**: 512MB - 1GB
- **Medium systems**: 1GB - 4GB
- **Large systems**: 4GB - 16GB
- **Enterprise**: 16GB+

## 🔍 Configuration Validation

### Schema Validation

Crush validates configuration against a schema:

```typescript
interface AppConfig {
  readonly storage: StorageConfig;
  readonly logging: LoggingConfig;
  readonly security: SecurityConfig;
  readonly performance: PerformanceConfig;
}
```

### Validation Errors

Common validation errors and solutions:

#### Invalid Log Level

```
Error: Invalid log level 'invalid'. Must be one of: debug, info, warn, error
```

**Solution:** Use a valid log level from the allowed values.

#### Invalid Storage Type

```
Error: Invalid storage type 'invalid'. Must be one of: file, database
```

**Solution:** Use either `"file"` or `"database"` as the storage type.

#### Invalid Timeout Value

```
Error: Timeout must be between 1000 and 3600000 milliseconds
```

**Solution:** Set timeout between 1 second and 1 hour.

#### Missing Required Fields

```
Error: Required field 'storage.path' is missing
```

**Solution:** Provide all required configuration fields.

## 🛠️ Configuration Management

### Environment-Specific Configs

Use different configuration files for different environments:

```bash
# Development
cp crush.config.dev.json crush.config.json

# Production
cp crush.config.prod.json crush.config.json

# Testing
cp crush.config.test.json crush.config.json
```

### Configuration Templates

Create configuration templates for different use cases:

#### Minimal Configuration

```json
{
  "storage": {
    "type": "file",
    "path": "./.crush/data"
  }
}
```

#### Full Configuration

```json
{
  "storage": {
    "type": "file",
    "path": "./.crush/data"
  },
  "logging": {
    "level": "info",
    "format": "pretty",
    "output": "console"
  },
  "security": {
    "encryptionKey": "your-encryption-key",
    "rateLimit": {
      "requests": 100,
      "window": 60000
    }
  },
  "performance": {
    "maxConcurrentAgents": 5,
    "maxConcurrentTasks": 10,
    "timeout": 30000,
    "memoryLimit": 1073741824
  }
}
```

### Configuration Backup

Backup your configuration files:

```bash
# Backup current configuration
cp crush.config.json crush.config.json.backup

# Restore from backup
cp crush.config.json.backup crush.config.json
```

## 🔧 Troubleshooting

### Configuration Not Loading

**Problem:** Configuration file not being loaded

**Solutions:**

1. Check file location and permissions
2. Verify JSON syntax is valid
3. Use absolute paths for file locations
4. Check environment variable overrides

### Performance Issues

**Problem:** Slow performance or resource exhaustion

**Solutions:**

1. Reduce concurrency limits
2. Increase timeout values
3. Monitor memory usage
4. Optimize task configurations

### Security Issues

**Problem:** Security warnings or failures

**Solutions:**

1. Use strong encryption keys
2. Configure proper rate limits
3. Validate input data
4. Use secure file permissions

## 📚 Related Documentation

- [CLI Reference](cli-reference.md) - Command-line options
- [Architecture Overview](architecture.md) - System architecture
- [Agent Development](agent-development.md) - Agent configuration
- [Examples](examples.md) - Configuration examples

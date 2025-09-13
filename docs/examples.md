# Examples and Tutorials

This document provides practical examples and tutorials for using Crush in real-world scenarios.

## 🚀 Quick Start Examples

### Example 1: Your First Agent

Create a simple agent that performs a basic task:

```bash
# Create your first agent
crush agent create hello-world --description "My first Crush agent"

# List agents to see what was created
crush agent list

# Get details about the agent
crush agent get <agent-id>

# Run the agent (dry run to see what would happen)
crush agent run <agent-id> --dry-run
```

**Expected Output:**
```
✅ Agent created successfully!
   ID: 1724243d-344e-42ec-97e8-e53a2c8fd9d8
   Name: hello-world
   Description: My first Crush agent
   Status: idle
   Created: 2024-01-15T10:30:00.000Z

Found 1 agent(s):

1. hello-world (1724243d-344e-42ec-97e8-e53a2c8fd9d8)
   Description: My first Crush agent
   Status: idle
   Tasks: 0
   Created: 2024-01-15T10:30:00.000Z
   Updated: 2024-01-15T10:30:00.000Z
```

### Example 2: Agent with Custom Configuration

Create an agent with custom timeout and retry settings:

```bash
crush agent create robust-agent \
  --description "Agent with custom retry policy" \
  --timeout 60000 \
  --max-retries 5 \
  --retry-delay 2000 \
  --retry-backoff exponential
```

**Expected Output:**
```
✅ Agent created successfully!
   ID: 3705b499-ff20-4c07-8b74-3728f049e889
   Name: robust-agent
   Description: Agent with custom retry policy
   Status: idle
   Created: 2024-01-15T10:35:00.000Z
   Timeout: 60000ms
   Retry Policy: 5 retries, 2000ms delay, exponential backoff
```

## 📊 Real-World Examples

### Example 1: Database Backup Agent

Create an agent that performs daily database backups:

```bash
# Create the backup agent
crush agent create db-backup \
  --description "Daily database backup agent" \
  --timeout 1800000 \
  --max-retries 3 \
  --retry-delay 5000 \
  --retry-backoff exponential
```

**Agent Configuration (when task system is implemented):**
```json
{
  "id": "db-backup-agent",
  "name": "db-backup",
  "description": "Daily database backup agent",
  "config": {
    "tasks": [
      {
        "id": "create-backup-dir",
        "name": "Create Backup Directory",
        "description": "Ensure backup directory exists",
        "type": "command",
        "config": {
          "command": "mkdir -p /backups/$(date +%Y-%m-%d)"
        }
      },
      {
        "id": "backup-database",
        "name": "Backup Database",
        "description": "Create database backup",
        "type": "command",
        "dependencies": ["create-backup-dir"],
        "config": {
          "command": "pg_dump mydb > /backups/$(date +%Y-%m-%d)/backup.sql",
          "environment": {
            "PGPASSWORD": "secret"
          }
        }
      },
      {
        "id": "compress-backup",
        "name": "Compress Backup",
        "description": "Compress backup file",
        "type": "command",
        "dependencies": ["backup-database"],
        "config": {
          "command": "gzip /backups/$(date +%Y-%m-%d)/backup.sql"
        }
      },
      {
        "id": "upload-to-cloud",
        "name": "Upload to Cloud",
        "description": "Upload backup to cloud storage",
        "type": "api",
        "dependencies": ["compress-backup"],
        "config": {
          "url": "https://storage.example.com/upload",
          "method": "POST",
          "headers": {
            "Authorization": "Bearer ${CLOUD_TOKEN}"
          }
        }
      }
    ],
    "timeout": 1800000,
    "retryPolicy": {
      "maxRetries": 3,
      "delay": 5000,
      "backoff": "exponential"
    }
  }
}
```

### Example 2: Data Processing Pipeline

Create an agent that processes incoming data files:

```bash
# Create the data processing agent
crush agent create data-processor \
  --description "Process incoming data files" \
  --timeout 3600000 \
  --max-retries 2
```

**Agent Configuration:**
```json
{
  "id": "data-processor-agent",
  "name": "data-processor",
  "description": "Process incoming data files",
  "config": {
    "tasks": [
      {
        "id": "monitor-input",
        "name": "Monitor Input Directory",
        "description": "Watch for new data files",
        "type": "file",
        "config": {
          "filePath": "/data/input",
          "operation": "watch",
          "pattern": "*.json"
        }
      },
      {
        "id": "validate-data",
        "name": "Validate Data",
        "description": "Validate incoming data format",
        "type": "script",
        "dependencies": ["monitor-input"],
        "config": {
          "script": `
            const fs = require('fs');
            const path = require('path');
            
            const inputFile = process.env.INPUT_FILE;
            const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
            
            // Validate required fields
            if (!data.id || !data.timestamp || !data.payload) {
              throw new Error('Invalid data format');
            }
            
            console.log('Data validation passed');
          `,
          "environment": {
            "INPUT_FILE": "/data/input/new-file.json"
          }
        }
      },
      {
        "id": "transform-data",
        "name": "Transform Data",
        "description": "Transform data to target format",
        "type": "script",
        "dependencies": ["validate-data"],
        "config": {
          "script": `
            const fs = require('fs');
            const path = require('path');
            
            const inputFile = process.env.INPUT_FILE;
            const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
            
            // Transform data
            const transformed = {
              id: data.id,
              processedAt: new Date().toISOString(),
              originalTimestamp: data.timestamp,
              data: data.payload,
              metadata: {
                source: 'data-processor',
                version: '1.0'
              }
            };
            
            // Write transformed data
            const outputFile = path.join('/data/output', \`transformed-\${data.id}.json\`);
            fs.writeFileSync(outputFile, JSON.stringify(transformed, null, 2));
            
            console.log(\`Transformed data written to \${outputFile}\`);
          `
        }
      },
      {
        "id": "load-to-database",
        "name": "Load to Database",
        "description": "Load transformed data into database",
        "type": "api",
        "dependencies": ["transform-data"],
        "config": {
          "url": "https://api.example.com/data",
          "method": "POST",
          "headers": {
            "Authorization": "Bearer ${API_TOKEN}",
            "Content-Type": "application/json"
          },
          "body": {
            "source": "data-processor",
            "data": "${TRANSFORMED_DATA}"
          }
        }
      },
      {
        "id": "archive-file",
        "name": "Archive File",
        "description": "Move processed file to archive",
        "type": "file",
        "dependencies": ["load-to-database"],
        "config": {
          "filePath": "/data/input/new-file.json",
          "operation": "move",
          "destination": "/data/archive/processed/"
        }
      }
    ],
    "timeout": 3600000,
    "retryPolicy": {
      "maxRetries": 2,
      "delay": 10000,
      "backoff": "exponential"
    }
  }
}
```

### Example 3: API Monitoring Agent

Create an agent that monitors API health and performance:

```bash
# Create the API monitoring agent
crush agent create api-monitor \
  --description "Monitor API health and performance" \
  --timeout 300000 \
  --max-retries 5 \
  --retry-delay 1000
```

**Agent Configuration:**
```json
{
  "id": "api-monitor-agent",
  "name": "api-monitor",
  "description": "Monitor API health and performance",
  "config": {
    "tasks": [
      {
        "id": "health-check",
        "name": "Health Check",
        "description": "Check API health endpoint",
        "type": "api",
        "config": {
          "url": "https://api.example.com/health",
          "method": "GET",
          "timeout": 30000
        }
      },
      {
        "id": "performance-check",
        "name": "Performance Check",
        "description": "Check API performance metrics",
        "type": "api",
        "config": {
          "url": "https://api.example.com/metrics",
          "method": "GET",
          "headers": {
            "Authorization": "Bearer ${METRICS_TOKEN}"
          }
        }
      },
      {
        "id": "analyze-results",
        "name": "Analyze Results",
        "description": "Analyze health and performance data",
        "type": "script",
        "dependencies": ["health-check", "performance-check"],
        "config": {
          "script": `
            const healthData = JSON.parse(process.env.HEALTH_DATA || '{}');
            const metricsData = JSON.parse(process.env.METRICS_DATA || '{}');
            
            const analysis = {
              timestamp: new Date().toISOString(),
              health: {
                status: healthData.status,
                uptime: healthData.uptime,
                version: healthData.version
              },
              performance: {
                responseTime: metricsData.responseTime,
                throughput: metricsData.throughput,
                errorRate: metricsData.errorRate
              },
              alerts: []
            };
            
            // Check for issues
            if (healthData.status !== 'healthy') {
              analysis.alerts.push('API health check failed');
            }
            
            if (metricsData.responseTime > 1000) {
              analysis.alerts.push('High response time detected');
            }
            
            if (metricsData.errorRate > 0.05) {
              analysis.alerts.push('High error rate detected');
            }
            
            console.log('Analysis completed:', JSON.stringify(analysis, null, 2));
          `,
          "environment": {
            "HEALTH_DATA": "${HEALTH_CHECK_RESULT}",
            "METRICS_DATA": "${PERFORMANCE_CHECK_RESULT}"
          }
        }
      },
      {
        "id": "send-alerts",
        "name": "Send Alerts",
        "description": "Send alerts if issues detected",
        "type": "api",
        "dependencies": ["analyze-results"],
        "config": {
          "url": "https://alerts.example.com/send",
          "method": "POST",
          "headers": {
            "Authorization": "Bearer ${ALERT_TOKEN}",
            "Content-Type": "application/json"
          },
          "body": {
            "source": "api-monitor",
            "alerts": "${ANALYSIS_ALERTS}",
            "timestamp": "${ANALYSIS_TIMESTAMP}"
          }
        }
      }
    ],
    "timeout": 300000,
    "retryPolicy": {
      "maxRetries": 5,
      "delay": 1000,
      "backoff": "exponential"
    }
  }
}
```

## 🔧 Configuration Examples

### Development Configuration

Create a configuration file for development:

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

Create a configuration file for production:

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

## 🚀 Advanced Usage Examples

### Example 1: Multi-Agent Workflow

Create multiple agents that work together:

```bash
# Create data collection agent
crush agent create data-collector \
  --description "Collect data from various sources" \
  --timeout 1800000

# Create data processor agent
crush agent create data-processor \
  --description "Process collected data" \
  --timeout 3600000

# Create report generator agent
crush agent create report-generator \
  --description "Generate reports from processed data" \
  --timeout 900000

# Create notification agent
crush agent create notifier \
  --description "Send notifications and alerts" \
  --timeout 300000
```

**Workflow Execution:**
```bash
# Run agents in sequence
crush agent run <data-collector-id>
crush agent run <data-processor-id>
crush agent run <report-generator-id>
crush agent run <notifier-id>
```

### Example 2: Environment-Specific Agents

Create agents for different environments:

```bash
# Development environment
crush agent create dev-backup \
  --description "Development database backup" \
  --timeout 300000

# Staging environment
crush agent create staging-backup \
  --description "Staging database backup" \
  --timeout 600000

# Production environment
crush agent create prod-backup \
  --description "Production database backup" \
  --timeout 1800000
```

### Example 3: Scheduled Operations

Create agents for different time-based operations:

```bash
# Daily operations
crush agent create daily-cleanup \
  --description "Daily cleanup operations" \
  --timeout 900000

# Weekly operations
crush agent create weekly-backup \
  --description "Weekly backup operations" \
  --timeout 3600000

# Monthly operations
crush agent create monthly-report \
  --description "Monthly report generation" \
  --timeout 1800000
```

## 🔍 Troubleshooting Examples

### Example 1: Debugging Agent Creation

```bash
# Enable verbose logging
crush --verbose agent create test-agent --description "Test agent for debugging"

# Check agent details
crush agent get <agent-id>

# Run in dry-run mode
crush agent run <agent-id> --dry-run
```

### Example 2: Handling Errors

```bash
# Try to create agent with invalid name
crush agent create "invalid name with spaces"

# Expected error:
# ❌ Validation error: Agent name can only contain letters, numbers, underscores, and hyphens

# Try to get non-existent agent
crush agent get non-existent-id

# Expected error:
# ❌ Agent with ID "non-existent-id" not found
```

### Example 3: Configuration Issues

```bash
# Try to create agent with invalid timeout
crush agent create test-agent --timeout 500

# Expected error:
# ❌ Configuration error: Timeout must be between 1000ms and 3600000ms (1 hour)
```

## 📊 Monitoring Examples

### Example 1: Agent Status Monitoring

```bash
# List all agents with their status
crush agent list

# Get detailed information about a specific agent
crush agent get <agent-id>

# Monitor agent execution
crush agent run <agent-id> --watch
```

### Example 2: Log Monitoring

```bash
# View recent logs
crush logs

# Follow logs in real-time
crush logs --follow

# View only error logs
crush logs --level error

# View debug logs
crush logs --level debug --follow
```

## 🔧 Integration Examples

### Example 1: Shell Script Integration

Create a shell script that uses Crush:

```bash
#!/bin/bash

# backup.sh - Database backup script using Crush

echo "Starting database backup process..."

# Create backup agent
AGENT_ID=$(crush agent create db-backup \
  --description "Automated database backup" \
  --timeout 1800000 \
  --max-retries 3 | grep "ID:" | cut -d' ' -f3)

echo "Created backup agent: $AGENT_ID"

# Run backup
crush agent run $AGENT_ID

# Check exit code
if [ $? -eq 0 ]; then
    echo "Backup completed successfully"
    
    # Clean up agent
    crush agent delete $AGENT_ID
    echo "Cleaned up backup agent"
else
    echo "Backup failed"
    exit 1
fi
```

### Example 2: CI/CD Integration

Create a CI/CD pipeline that uses Crush:

```yaml
# .github/workflows/deploy.yml
name: Deploy with Crush

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install Crush
      run: npm install -g crush
    
    - name: Create deployment agent
      run: |
        crush agent create deploy-agent \
          --description "Deployment automation agent" \
          --timeout 1800000
    
    - name: Run deployment
      run: |
        AGENT_ID=$(crush agent list | grep "deploy-agent" | cut -d'(' -f2 | cut -d')' -f1)
        crush agent run $AGENT_ID
    
    - name: Cleanup
      if: always()
      run: |
        AGENT_ID=$(crush agent list | grep "deploy-agent" | cut -d'(' -f2 | cut -d')' -f1)
        crush agent delete $AGENT_ID
```

## 📚 Best Practices Examples

### Example 1: Naming Conventions

```bash
# Good naming examples
crush agent create daily-backup
crush agent create api-monitor
crush agent create data-processor
crush agent create report-generator

# Bad naming examples (avoid)
crush agent create "my agent"  # Spaces not allowed
crush agent create agent1      # Not descriptive
crush agent create test        # Too generic
```

### Example 2: Configuration Best Practices

```bash
# Good configuration
crush agent create robust-agent \
  --description "Agent with proper timeout and retry settings" \
  --timeout 300000 \
  --max-retries 3 \
  --retry-delay 5000 \
  --retry-backoff exponential

# Bad configuration (avoid)
crush agent create bad-agent \
  --timeout 500 \        # Too short
  --max-retries 20 \     # Too many retries
  --retry-delay 10       # Too short delay
```

### Example 3: Error Handling

```bash
# Good error handling in scripts
#!/bin/bash

set -e  # Exit on any error

# Create agent with error handling
if ! crush agent create my-agent --description "My agent"; then
    echo "Failed to create agent"
    exit 1
fi

# Run agent with error handling
if ! crush agent run <agent-id>; then
    echo "Agent execution failed"
    # Cleanup on failure
    crush agent delete <agent-id>
    exit 1
fi

echo "Agent executed successfully"
```

## 🔗 Related Documentation

- [CLI Reference](cli-reference.md) - Complete command documentation
- [Agent Development](agent-development.md) - Creating and configuring agents
- [Task Types](task-types.md) - Available task types and usage
- [Configuration](configuration.md) - Configuration options and file format
- [Architecture Overview](architecture.md) - System architecture and design

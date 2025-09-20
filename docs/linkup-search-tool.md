# Linkup Search Tool

The Linkup search tool provides web search functionality to your crush CLI agents, enabling them to access current information from the internet to enrich their responses with factual, up-to-date data.

## Features

- **High-quality search results**: Uses Linkup's search engine, which is #1 in the world for factuality
- **Configurable parameters**: Control the number of results and metadata inclusion
- **Error handling**: Graceful handling of API errors and missing configuration
- **Integration**: Seamlessly integrates with the existing tool registry

## Configuration

Add the following to your `crush.config.json` file:

```json
{
  "linkup": {
    "apiKey": "your-linkup-api-key-here",
    "baseUrl": "https://api.linkup.so",
    "timeout": 30000
  }
}
```

### Configuration Options

- `apiKey` (required): Your Linkup API key
- `baseUrl` (optional): The Linkup API base URL (defaults to "https://api.linkup.so")
- `timeout` (optional): Request timeout in milliseconds (defaults to 30000)

## Usage

The tool is automatically registered and available to all agents. It can be called with the following parameters:

### Parameters

- `query` (required): The search query to execute. Be specific and detailed for better results.
- `maxResults` (optional): Maximum number of results to return (default: 5, max: 20)
- `includeMetadata` (optional): Whether to include additional metadata in results (default: false)

### Example Usage

```typescript
// Basic search
const result = await executeTool(
  "linkup_search",
  {
    query: "latest TypeScript features 2024",
  },
  { agentId: "my-agent" },
);

// Advanced search with more results and metadata
const result = await executeTool(
  "linkup_search",
  {
    query: "Effect-TS documentation",
    maxResults: 10,
    includeMetadata: true,
  },
  { agentId: "my-agent" },
);
```

### Response Format

The tool returns a structured response with the following format:

```typescript
interface LinkupSearchResult {
  results: LinkupSearchItem[];
  totalResults: number;
  query: string;
  timestamp: string;
}

interface LinkupSearchItem {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}
```

## Best Practices

1. **Be specific with queries**: More detailed and specific queries yield better results
2. **Use appropriate result limits**: Start with fewer results (5-10) unless you need comprehensive coverage
3. **Handle errors gracefully**: The tool includes comprehensive error handling, but always check the `success` field
4. **Consider metadata**: Enable metadata only when you need additional context about the sources

## Error Handling

The tool handles various error scenarios:

- **Missing API key**: Returns a clear error message about configuration
- **API errors**: Captures and reports HTTP errors from the Linkup API
- **Network issues**: Handles timeouts and connection problems
- **Invalid responses**: Gracefully handles malformed API responses

## Integration with Agents

The Linkup search tool is automatically available to all agents through the tool registry. Agents can use it to:

- Research current information
- Verify facts
- Gather context for decision-making
- Provide up-to-date responses to user queries

## Testing

The tool includes comprehensive tests covering:

- Tool creation and configuration
- Parameter validation
- Error handling scenarios
- API request formatting
- Response processing

Run the tests with:

```bash
npm test -- src/core/agent/tools/linkup-tools.test.ts
```

## Getting Started

1. Sign up for a Linkup API key at [https://docs.linkup.so](https://docs.linkup.so)
2. Add your API key to `crush.config.json`
3. The tool will be automatically available to your agents
4. Start using it in your agent workflows for enhanced search capabilities

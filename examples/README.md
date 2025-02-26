# Hataraku Examples

This directory contains example files demonstrating different features of Hataraku.

## Running Examples

You can run any example using:

```bash
npm run example <example-name>
```

For instance, to run the `basic` example:

```bash
npm run example basic
```

### Passing Arguments

Some examples accept or require arguments. You can pass them after the example name:

```bash
npm run example query "What's 3 + 3?"
npm run example tool "Write a function to calculate Fibonacci numbers"
```

Running without an example name will list all available examples:

```bash
npm run example
```

## Available Examples

- `basic` - Basic task execution
- `docs` - Workflow documentation example
- `gemini` - Fast poem generation using Google's Gemini Flash Lite model with streaming
- `hmcp` - Hataraku with MCP integration
- `jira` - MCP integration with Jira
- `math` - Simple math operations
- `mcp` - MCP agent example
- `multi` - Multi-step task execution
- `openrouter` - OpenRouter integration
- `parallel` - Parallel workflow execution
- `query` - Simple query example (requires a query argument)
- `schema` - Schema validation example
- `stream` - Streaming task example
- `struct` - Structured task execution
- `struct-or` - Structured task with OpenRouter
- `thread` - Thread reuse example
- `tool` - Tool use example (accepts a prompt argument)
- `vertex` - Google Vertex AI integration example
- `openai` - OpenAI integration example
- `anthropic` - Anthropic integration example

## Special Commands

- `hmcp-inspector` - Run the hmcp example with the MCP inspector

## Environment Variables

Examples require certain environment variables to be set in a `.env` file at the root of the project:

```
# For OpenRouter examples
OPENROUTER_API_KEY=your_api_key_here

# For Google Vertex AI examples
# Set the path to your Google Cloud service account key file
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
# Or set your Google Cloud project ID (optional)
GOOGLE_CLOUD_PROJECT=your-project-id

# For OpenAI examples
OPENAI_API_KEY=your_openai_api_key_here

# For Anthropic examples
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

The example runner automatically loads these variables from the `.env` file.
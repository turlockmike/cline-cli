# Hataraku CLI Test Commands

This document provides a comprehensive list of example commands to test various features of the Hataraku CLI.

## File Operations
```bash
# Create a new file
hataraku "create a new file called hello.txt with the text 'Hello, World!'"

# Read and explain a file
hataraku "read the contents of hello.txt and explain what it does"

# Search through files
hataraku "find all files containing the word 'test' in this project"

# Create a complex file structure
hataraku "create a basic React component structure with index.js, styles.css, and tests"
```

## Code Analysis
```bash
# List code definitions
hataraku "show me all the function definitions in src/cli.ts"

# Code explanation
hataraku "analyze the code in src/core/agent.ts and explain what it does"

# Search and replace
hataraku "find all console.log statements and replace them with console.debug"
```

## System Commands
```bash
# Execute git commands
hataraku "initialize a git repository and create an initial commit"

# List directory contents
hataraku "show me all TypeScript files in the src directory"

# Run npm commands
hataraku "install the lodash package and add it to package.json"
```

## Interactive Mode Examples
```bash
# Start interactive mode
hataraku -i

# Start interactive mode with initial task
hataraku -i "create a new project structure"
```

## Different Models/Providers
```bash
# Use different models
hataraku --model anthropic/claude-3.7-sonnet "explain this codebase"
hataraku --model deepseek/deepseek-chat "optimize this function"

# Use different providers
hataraku --provider anthropic "write unit tests"
hataraku --provider openai "debug this code"
```

## Special Features
```bash
# Disable streaming for precise output
hataraku --no-stream "generate a JSON configuration"

# Disable sound for quiet operation
hataraku --no-sound "run silent task"

# Enable verbose mode for detailed output
hataraku --verbose "debug this complex issue"

# Web Interface
hataraku serve --port 3000
```

## Complex Tasks
```bash
# Multi-step operations
hataraku "create a full Express.js API endpoint with route, controller, and tests"

# Code generation with specific requirements
hataraku "create a TypeScript class that implements the Repository pattern"

# Project analysis
hataraku "analyze this project's structure and suggest improvements"
```

## Tool-Specific Tasks
```bash
# Image operations
hataraku "show me a diagram of the current project structure"

# Audio feedback
hataraku "play a sound when the task completes"

# Network operations
hataraku "fetch the latest version of Node.js and tell me what's new"
```

## Setup Requirements

Before running these commands, ensure you have:

1. Set up your API key:
   ```bash
   export OPENROUTER_API_KEY=your_key_here
   ```
   
2. Are in the project directory
3. Have necessary permissions for file operations

Note: Some commands may require additional setup or dependencies depending on your system configuration.

## Available Tools

The CLI has access to the following tool categories:

- **File System Tools**: read_file, write_file, list_files, search_files, search_and_replace, insert_content, apply_diff
- **Network Tools**: fetch
- **System Tools**: execute_command
- **Code Analysis Tools**: list_code_definitions
- **Media Tools**: play_audio, show_image, text-to-speech (Kokoro TTS)

Each command above demonstrates the use of one or more of these tools to accomplish various tasks. 
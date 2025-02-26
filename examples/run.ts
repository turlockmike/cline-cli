#!/usr/bin/env tsx

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Get example name from command line arguments
const exampleName = process.argv[2];
// Get remaining arguments to pass to the example
const exampleArgs = process.argv.slice(3);

// For environment variables that need to be loaded
if (fs.existsSync(path.join(process.cwd(), '.env'))) {
  try {
    const envFile = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    
    // Load OpenRouter API key
    if (!process.env.OPENROUTER_API_KEY) {
      const openrouterApiKey = envFile.match(/OPENROUTER_API_KEY=(.+)/)?.[1];
      if (openrouterApiKey) {
        process.env.OPENROUTER_API_KEY = openrouterApiKey;
      }
    }
    
    // Load Google Cloud project ID
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      const googleCloudProject = envFile.match(/GOOGLE_CLOUD_PROJECT=(.+)/)?.[1];
      if (googleCloudProject) {
        process.env.GOOGLE_CLOUD_PROJECT = googleCloudProject;
      }
    }
    
    // Load Google Application Credentials path
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const googleCredentials = envFile.match(/GOOGLE_APPLICATION_CREDENTIALS=(.+)/)?.[1];
      if (googleCredentials) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = googleCredentials;
      }
    }
    
    // Load OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      const openaiApiKey = envFile.match(/OPENAI_API_KEY=(.+)/)?.[1];
      if (openaiApiKey) {
        process.env.OPENAI_API_KEY = openaiApiKey;
      }
    }
    
    // Load Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      const anthropicApiKey = envFile.match(/ANTHROPIC_API_KEY=(.+)/)?.[1];
      if (anthropicApiKey) {
        process.env.ANTHROPIC_API_KEY = anthropicApiKey;
      }
    }
  } catch (error) {
    console.warn('Warning: Could not read .env file for environment variables.');
  }
}

if (!exampleName || exampleName === 'run' || exampleName === 'help') {
  console.log('Available examples:');
  
  // List all TypeScript files in the examples directory
  const exampleFiles = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.ts') && file !== 'run.ts' && file !== 'tsconfig.json');
  
  exampleFiles.forEach(file => {
    console.log(`  - ${path.basename(file, '.ts')}`);
  });
  
  console.log('\nUsage: npm run example <example-name> [args...]');
  process.exit(0);
}

// Construct the path to the example file
const exampleFile = path.join(__dirname, `${exampleName}.ts`);

// Check if the example file exists
if (!fs.existsSync(exampleFile)) {
  console.error(`Error: Example '${exampleName}' not found.`);
  process.exit(1);
}

// Special case for hmcp-inspector (previously hataraku-mcp-inspector)
if (exampleName === 'hmcp-inspector') {
  try {
    execSync('npx @modelcontextprotocol/inspector tsx examples/hmcp.ts', { 
      stdio: 'inherit',
      env: process.env 
    });
    process.exit(0);
  } catch (error) {
    console.error('Error running inspector:', error);
    process.exit(1);
  }
}

try {
  // Execute the TypeScript file directly instead of requiring it
  // This gives better support for ESM modules and proper execution context
  // Forward any additional arguments to the example
  const argsString = exampleArgs.length > 0 ? ` ${exampleArgs.join(' ')}` : '';
  execSync(`tsx ${exampleFile}${argsString}`, { 
    stdio: 'inherit',
    env: process.env
  });
} catch (error) {
  console.error('Error running example:', error);
  process.exit(1);
} 
import { createWorkflow } from '../core/workflow';
import { z } from 'zod';
import { createAgent } from '../core/agent';
import { createTask } from '../core/task';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Tool } from 'ai';
import type { TaskExecutor } from '../core/workflow';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

// Initialize OpenRouter
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Define our deterministic tools
const readPackageJsonTool: Tool = {
  description: 'Read and parse package.json file',
  parameters: z.object({
    path: z.string(),
  }),
  execute: async ({ path }) => {
    console.log(chalk.blue(`📦 Reading package.json at: ${path}`));
    const content = await fs.readFile(path, 'utf-8');
    return {
      content: [{
        type: 'text',
        text: content
      }]
    };
  }
};

const scanDirectoryTool: Tool = {
  description: 'Scan directory for files matching a pattern',
  parameters: z.object({
    dir: z.string(),
    pattern: z.string(),
  }),
  execute: async ({ dir, pattern }) => {
    console.log(chalk.blue(`🔍 Scanning directory: ${dir} for pattern: ${pattern}`));
    // This would use glob or similar in production
    const files = await fs.readdir(dir);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(files)
      }]
    };
  }
};

const validateUrlTool: Tool = {
  description: 'Validate if a URL is accessible',
  parameters: z.object({
    url: z.string(),
  }),
  execute: async ({ url }) => {
    console.log(chalk.blue(`🔗 Validating URL: ${url}`));
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ valid: response.ok, status: response.status })
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ valid: false, error: error.message })
        }]
      };
    }
  }
};

// Create an agent for documentation tasks
const docsAgent = createAgent({
  name: 'Documentation Agent',
  description: 'An agent that generates and validates documentation',
  role: 'You are a documentation expert that helps generate and validate technical documentation.',
  model: openrouter.chat('anthropic/claude-3.5-sonnet'),
  tools: {
    readPackageJson: readPackageJsonTool,
    scanDirectory: scanDirectoryTool,
    validateUrl: validateUrlTool
  }
});

// Define our schemas
const repoAnalysisSchema = z.object({
  name: z.string(),
  version: z.string(),
  dependencies: z.record(z.string(), z.string()),
  devDependencies: z.record(z.string(), z.string()).optional(),
  fileStructure: z.array(z.string()),
  mainEntryPoints: z.array(z.string())
});

const docsExtractionSchema = z.object({
  apis: z.array(z.object({
    name: z.string(),
    description: z.string(),
    examples: z.array(z.string())
  })),
  usage: z.array(z.string()),
  setup: z.array(z.string())
});

const readmeContentSchema = z.object({
  title: z.string(),
  description: z.string(),
  installation: z.string(),
  usage: z.string(),
  api: z.string(),
  examples: z.array(z.string()),
  contributing: z.string(),
  license: z.string()
});

// Define our intelligent tasks
const analyzeRepoTask = createTask({
  name: 'Analyze Repository',
  description: 'Analyzes repository structure and package information',
  agent: docsAgent,
  outputSchema: repoAnalysisSchema,
  task: (input: { path: string }) => 
    `Analyze the repository at ${input.path}. Use the readPackageJson tool to read package.json and scanDirectory tool to understand the file structure. Focus on:
     1. Package name and version
     2. Dependencies and their versions
     3. File structure and organization
     4. Main entry points and important files`
});

const extractDocsTask = createTask({
  name: 'Extract Documentation',
  description: 'Analyzes source files to extract documentation needs',
  agent: docsAgent,
  outputSchema: docsExtractionSchema,
  task: (input: { files: string[] }) => 
    `Analyze these source files: ${input.files.join(', ')}. Identify:
     1. Public APIs and their usage
     2. Setup requirements
     3. Common use cases
     4. Example code snippets`
});

const generateReadmeTask = createTask({
  name: 'Generate README',
  description: 'Generates comprehensive README content',
  agent: docsAgent,
  outputSchema: readmeContentSchema,
  task: (input: { analysis: z.infer<typeof repoAnalysisSchema>, docs: z.infer<typeof docsExtractionSchema> }) => 
    `Generate a comprehensive README based on this repository analysis and documentation needs: ${JSON.stringify(input, null, 2)}. Include:
     1. Clear title and description
     2. Installation instructions based on dependencies
     3. Usage guide with examples
     4. API documentation
     5. Contributing guidelines
     6. License information`
});

// Create task executor wrappers
const analyzeRepo: TaskExecutor<{ path: string }, z.infer<typeof repoAnalysisSchema>> = 
  async (input) => {
    console.log(chalk.yellow(`📝 Starting repository analysis: ${input.path}`));
    const result = await analyzeRepoTask.run(input);
    console.log(chalk.green(`✅ Repository analysis complete`));
    return result;
  };

const extractDocs: TaskExecutor<{ files: string[] }, z.infer<typeof docsExtractionSchema>> = 
  async (input) => {
    console.log(chalk.yellow(`📝 Starting documentation extraction from ${input.files.length} files`));
    const result = await extractDocsTask.run(input);
    console.log(chalk.green(`✅ Documentation extraction complete`));
    return result;
  };

const generateReadme: TaskExecutor<
  { analysis: z.infer<typeof repoAnalysisSchema>; docs: z.infer<typeof docsExtractionSchema> },
  z.infer<typeof readmeContentSchema>
> = async (input) => {
  console.log(chalk.yellow(`📝 Generating README content`));
  const result = await generateReadmeTask.run(input);
  console.log(chalk.green(`✅ README generation complete`));
  return result;
};

// Define our workflow output schema
const docsWorkflowSchema = z.object({
  repoAnalysis: repoAnalysisSchema,
  extractedDocs: docsExtractionSchema,
  readmeContent: readmeContentSchema
});

type DocsWorkflowResult = z.infer<typeof docsWorkflowSchema>;

async function main() {
  console.log(chalk.cyan('\n🚀 Starting documentation workflow\n'));

  // Create our workflow
  const docsWorkflow = createWorkflow<{ repoPath: string }>({
    name: 'Repository Documentation',
    description: 'Generates and validates repository documentation',
    onTaskStart: (taskName) => {
      console.log(chalk.magenta(`⚡ Starting task: ${taskName}`));
    },
    onTaskComplete: (taskName, result) => {
      console.log(chalk.magenta(`🏁 Completed task: ${taskName}`));
      console.log(chalk.gray(`   Result: ${JSON.stringify(result)}\n`));
    }
  }, async (w) => {
    console.log(chalk.cyan('📊 Analyzing repository and extracting docs in parallel...'));
    
    // Execute initial tasks in parallel with proper typing
    const tasks = [
      {
        name: 'Repository Analysis',
        task: analyzeRepo,
        input: { path: w.input.repoPath }
      },
      {
        name: 'Documentation Extraction',
        task: extractDocs,
        input: { files: ['src/**/*.ts'] }
      }
    ] as const;

    const [repoAnalysis, extractedDocs] = await w.parallel(tasks);

    console.log(chalk.cyan('\n📊 Generating README...'));

    // Generate README based on analysis and extracted docs
    const readmeContent = await w.task(
      'Generate README',
      generateReadme,
      { analysis: repoAnalysis, docs: extractedDocs }
    );

    // Return the final result
    return {
      repoAnalysis,
      extractedDocs,
      readmeContent
    };
  });

  // Execute the workflow
  const input = {
    repoPath: '.'
  };

  console.log(chalk.cyan('📥 Input:'));
  console.log(chalk.gray(`   Repository path: ${input.repoPath}\n`));

  const result = await docsWorkflow.run(input, {
    outputSchema: docsWorkflowSchema
  });

  console.log(chalk.cyan('\n📊 Final Results:'));
  console.log(chalk.gray(`   Repository Analysis: ${JSON.stringify(result.repoAnalysis, null, 2)}`));
  console.log(chalk.gray(`   Extracted Docs: ${JSON.stringify(result.extractedDocs, null, 2)}`));
  console.log(chalk.gray(`   README Content: ${JSON.stringify(result.readmeContent, null, 2)}\n`));
}

// Run the example if this file is executed directly
main() 
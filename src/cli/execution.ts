import chalk from 'chalk';
import { colors, log } from '../utils/colors';
import { PassThrough } from 'node:stream';
import { input } from '@inquirer/prompts';
import { Command } from 'commander';
import { createCLIAgent } from '../core/agents';
import { createBedrockModel } from '../core/providers/bedrock';
import { playAudioTool } from '../core/tools/play-audio';
import { ConfigLoader, CliOptions } from '../config/ConfigLoader';
import { ProfileManager } from '../config/ProfileManager';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LanguageModelV1 } from 'ai';
/**
 * Process streams from agent responses
 */
export async function processStreams(textStream: AsyncIterable<string>, options: any) {
  const consoleStream = new PassThrough();
  const sourceStream = new PassThrough();
  let fullText = '';  // Collect full text for TTS

  // Convert AsyncIterable to stream
  const streamPromise = (async () => {
    try {
      for await (const chunk of textStream) {
        sourceStream.write(chunk);
        if (options.withAudio) {
          fullText += chunk;  // Collect text for TTS
        }
      }
      sourceStream.end();
    } catch (err) {
      sourceStream.destroy(err as Error);
      throw err; // Re-throw to be caught by the outer try-catch
    }
  })();

  // Pipe source to console
  sourceStream.pipe(consoleStream);

  // Set up console output with color
  consoleStream.on('data', (chunk) => {
    // Color the agent's output in green
    process.stdout.write(colors.success(chunk.toString()));
  });

  // Wait for both the stream processing and console output to finish
  await Promise.all([
    streamPromise,
    new Promise<void>((resolve, reject) => {
      consoleStream.on('end', resolve);
      consoleStream.on('error', reject);
    })
  ]);

  // Add a newline at the end for better formatting
  process.stdout.write('\n');
}

// Add a local interface extension for CLI options
export interface CliOptionsWithInteractive extends CliOptions {
  interactive?: boolean;
}

/**
 * Execute a task with the given configuration
 */
export async function executeWithConfig(task: string, cliOptions: CliOptions, interactive?: boolean) {
  try {
    const configLoader = new ConfigLoader();
    const { profile, agent } = await configLoader.getEffectiveConfig(cliOptions);
    
    // Determine configuration options
    const shouldUseInteractive = interactive !== undefined ? interactive : false;
    const shouldStream = cliOptions.stream !== undefined ? cliOptions.stream : profile.options?.stream;
    const shouldPlaySound = cliOptions.sound !== undefined ? cliOptions.sound : profile.options?.sound;
    const shouldShowVerbose = cliOptions.verbose === true;
    
    // Determine which model to use
    let model: LanguageModelV1 | Promise<LanguageModelV1>;
    const provider = cliOptions.provider || profile.provider;
    const modelName = cliOptions.model || profile.model;
    
    if (!provider) {
      log.error('Error: No provider specified in profile or command line.');
      return 1;
    }
    
    if (!modelName) {
      log.error('Error: No model specified in profile or command line.');
      return 1;
    }
    
    if (provider === 'bedrock') {
      // Use AWS Bedrock
      const awsProfile = cliOptions.profile || profile.providerOptions?.profile || 'default';
      model = await createBedrockModel(awsProfile, modelName);
    } else {
      // Check for API key for other providers
      const apiKey = cliOptions.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
      if (!apiKey) {
        log.error(`Error: API key required. Provide via --api-key or ${provider.toUpperCase()}_API_KEY env var`);
        return 1;
      }

      // Initialize OpenRouter client
      const openrouter = createOpenRouter({
        apiKey,
      });
      model = openrouter.chat(modelName);
    }

    // Initialize agent using our factory function and include MCP tools
    const cliAgent = await createCLIAgent(model, {
      verbose: shouldShowVerbose
    });
    
    // Output verbose information if enabled
    if (shouldShowVerbose) {
      log.system('\nVerbose mode enabled. Showing intermediate task information.');
      log.system(`Using provider: ${provider}, model: ${modelName}`);
      log.system(`Stream: ${shouldStream ? 'enabled' : 'disabled'}, Sound: ${shouldPlaySound ? 'enabled' : 'disabled'}`);
    }
    
    log.system('\n🔍 Processing task...');
    
    // Options object for functions
    const options = {
      sound: shouldPlaySound,
      stream: shouldStream,
      verbose: shouldShowVerbose
    };

    if (shouldUseInteractive) {
      // Interactive mode
      async function runInteractiveTask(currentTask?: string) {
        let taskToRun = currentTask;

        if (!taskToRun) {
          taskToRun = await input({
            message: 'Enter your task, or type "exit" to quit:',
            default: task // Use provided task argument as default if available
          });

          if (!taskToRun || taskToRun === 'exit') {
            log.warning('Exiting interactive mode.');
            return 0;
          }
        }

        log.system(`\nExecuting task: ${taskToRun}`);
        
        try {
          if (shouldStream) {
            const result = await cliAgent.task(taskToRun, {
              stream: true,
              verbose: shouldShowVerbose
            });
            await processStreams(result, options);
          } else {
            const result = await cliAgent.task(taskToRun, {
              verbose: shouldShowVerbose
            });
            log.success(result);
          }
          
          // Add a small delay to ensure task history is saved
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Finally play the celebratory audio
          if (shouldPlaySound) {
            await playAudioTool.execute({ path: 'audio/celebration.wav' }, {toolCallId: 'celebration', messages: []});
          }

          // Prompt for next task
          return runInteractiveTask();
        } catch (error) {
          log.error(`Error executing task: ${error}`);
          return runInteractiveTask();
        }
      }

      return runInteractiveTask(task);
    } else {
      // Normal mode
      if (!task) {
        log.error('Error: Please provide a task or question');
        return 1;
      }

      log.system(`\nExecuting task: ${task}`);

      try {
        if (shouldStream) {
          const result = await cliAgent.task(task, { 
            stream: true,
            verbose: shouldShowVerbose
          });
          await processStreams(result, options);
        } else {
          const result = await cliAgent.task(task, {
            verbose: shouldShowVerbose
          });
          log.success(result);
        }
        
        // Add a small delay to ensure task history is saved
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (shouldPlaySound) {
          await playAudioTool.execute({ path: 'audio/celebration.wav' }, {toolCallId: 'celebration', messages: []});
        }
        return 0;
      } catch (error) {
        log.error(`Error executing task: ${error}`);
        return 1;
      }
    }
  } catch (error) {
    log.error(`Error: ${error}`);
    log.warning('\nDebug Information:');
    log.warning(`Provider: ${cliOptions.provider}`);
    log.warning(`Model: ${cliOptions.model}`);
    return 1;
  }
}

/**
 * Main function to handle command line invocation
 */
export async function main(task?: string, program?: Command) {
  const options = program?.opts() || {};
  const cliOptions: CliOptions = {
    profile: options.profile,
    provider: options.provider,
    model: options.model,
    apiKey: options.apiKey,
    stream: options.stream,
    sound: options.sound,
    verbose: options.verbose,
    agent: options.agent,
    region: options.region
  };
  
  // Handle interactive mode separately
  const isInteractive = options.interactive;
  
  return executeWithConfig(task, cliOptions, isInteractive);
}

/**
 * Function for programmatic CLI usage
 */
export async function runCLI(input: string): Promise<void> {
  try {
    const configLoader = new ConfigLoader();
    const profile = await (new ProfileManager()).getActiveProfile();
    
    const cliOptions: CliOptions = {
      provider: profile.provider,
      model: profile.model,
      stream: false,
      sound: false,
      verbose: false
    };
    
    await executeWithConfig(input, cliOptions, false);
  } catch (error) {
    log.error(`Error: ${error}`);
    throw error;
  }
}
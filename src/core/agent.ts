import {  LanguageModelV1, generateText, generateObject, streamText, ToolSet, CoreMessage, Message } from 'ai';
import { z } from 'zod';
import { AsyncIterableStream } from './types';
import { Thread } from './thread/thread';
import { TaskHistory, HistoryEntry } from './TaskHistory';
import { v4 as uuid } from 'uuid';
import { colors, log } from '../utils/colors';
const DEFAULT_MAX_STEPS = 25;
const DEFAULT_MAX_RETRIES = 4;

interface CallSettings {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string | undefined>;
  maxSteps?: number;
  toolChoice?: 'auto' | 'none' | 'required';
}

export interface AgentConfig {
  name: string;
  description: string;
  role: string; // System instructions for the agent
  model: LanguageModelV1 | Promise<LanguageModelV1>;
  tools?: ToolSet;
  callSettings?: CallSettings;
  taskHistory?: TaskHistory;
  verbose?: boolean; // Add verbose flag to configuration
}

export interface TaskInput<T = unknown> {
  thread?: Thread;
  schema?: z.ZodType<T>;
  stream?: boolean;
  verbose?: boolean; // Add verbose flag to TaskInput
}

export interface StreamingTaskResult {
  stream: AsyncGenerator<string>;
}

export class Agent {
  public readonly name: string;
  public readonly description: string;
  private readonly modelPromise: Promise<LanguageModelV1>;
  public readonly tools: ToolSet;
  public readonly callSettings: CallSettings;
  public readonly role: string;
  private readonly taskHistory?: TaskHistory;
  private readonly verbose: boolean;

  constructor(config: AgentConfig) {
    if (!config.name || config.name.trim() === '') {
      throw new Error('Agent name cannot be empty');
    }
    this.name = config.name;
    this.description = config.description;
    this.modelPromise = Promise.resolve(config.model);
    this.tools = config.tools || {};
    this.callSettings = config.callSettings || {};
    this.role = config.role;
    this.taskHistory = config.taskHistory;
    this.verbose = config.verbose || false;
  }

  private getSystemPrompt() {
    return `
    ROLE:
    ${this.role}

    DESCRIPTION given to the user:
    ${this.description}
    `
  }

  /**
   * Execute a task with the agent.
   * @param task - The task to execute.
   * @param input - The input to the task.
   * @returns The response from the task.
   */
  async task(task: string, input?: TaskInput & {stream: false | undefined }): Promise<string>;
  async task(task: string, input?: TaskInput & { stream: true}): Promise<AsyncIterableStream<string>>;
  async task<T>(task: string, input?: TaskInput<T> & { schema: z.ZodType<T>}): Promise<T>;
  async task(task: string, input?: TaskInput ): Promise<string>;
  async task<T>(task: string, input?: TaskInput<T> & { stream?: boolean; schema?: z.ZodType<T>}): Promise<string | AsyncIterableStream<string> | T> {
    const model = await this.modelPromise;
    const thread = input?.thread || new Thread();
    const maxSteps = this.callSettings.maxSteps || DEFAULT_MAX_STEPS;
    const maxRetries = this.callSettings.maxRetries || DEFAULT_MAX_RETRIES;
    thread.addMessage('user', task);
    
    // Use verbose mode if specified in input or agent config
    const isVerbose = input?.verbose !== undefined ? input.verbose : this.verbose;
    
    if (isVerbose) {
      log.system('\n🔍 Task details:');
      log.system(`Task: ${task}`);
      log.system(`Max steps: ${maxSteps}, Max retries: ${maxRetries}`);
      log.system(`Stream: ${input?.stream ? 'enabled' : 'disabled'}`);
      log.system('Thread history:');
      for (const msg of thread.getMessages()) {
        log.system(`- ${msg.role}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
      }
    }

    // Create history entry
    const taskId = uuid();
    const historyEntry: HistoryEntry = {
      taskId,
      timestamp: Date.now(),
      task,
      tokensIn: 0,
      tokensOut: 0,
      cacheWrites: 0,
      cacheReads: 0,
      totalCost: 0,
      model: model.constructor.name,
      messages: thread.getMessages()
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
      debug: {
        requests: [{
          timestamp: Date.now(),
          systemPrompt: this.getSystemPrompt(),
          messages: thread.getFormattedMessages()
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: Array.isArray(msg.content) 
                ? msg.content.map(part => 'text' in part ? part.text : '').join('')
                : msg.content
            }))
        }],
        responses: [],
        toolUsage: []
      }
    };
   
    if (input?.stream) {
      const {textStream} = streamText({
        model,
        system: this.getSystemPrompt(),
        messages: thread.getFormattedMessages(),
        maxSteps,
        maxRetries,
        tools: this.tools,
        ...this.callSettings,
        onError: (error) => {
          console.error('Error streaming text', error);
          if (this.taskHistory && historyEntry.debug) {
            historyEntry.debug.responses.push({
              timestamp: Date.now(),
              content: error instanceof Error ? error.message : String(error),
              usage: {
                tokensIn: 0,
                tokensOut: 0,
                cost: 0
              }
            });
            // Add to tool usage for error tracking
            historyEntry.debug.toolUsage.push({
              timestamp: Date.now(),
              tool: 'stream',
              params: {},
              result: error instanceof Error ? error.message : String(error),
              error: true
            });
            this.taskHistory.saveTask(historyEntry).catch(console.error);
          }
        },
        onFinish: (result) => {
          thread.addMessage('assistant', result.text);
          if (this.taskHistory && historyEntry.debug) {
            historyEntry.debug.responses.push({
              timestamp: Date.now(),
              content: result.text,
              usage: {
                tokensIn: result.usage?.promptTokens || 0,
                tokensOut: result.usage?.completionTokens || 0,
                cost: 0 // Cost calculation would need provider-specific logic
              }
            });
            historyEntry.tokensIn += result.usage?.promptTokens || 0;
            historyEntry.tokensOut += result.usage?.completionTokens || 0;
            this.taskHistory.saveTask(historyEntry).catch(console.error);
          }
        }
      });

      return textStream;
    }

    try {
      let result;
      if (Object.keys(this.tools).length > 0 && input?.schema) {
        result = await generateText({
          model,
          system: this.getSystemPrompt(),
          messages: thread.getFormattedMessages(),
          maxSteps,
          maxRetries,
          tools: this.tools,
          ...this.callSettings,
        });
        thread.addMessage('assistant', result.text);
        thread.addMessage('user', 'Based on the last response, please create a response that matches the schema provided. It must be valid JSON and match the schema exactly.');
        
        if (this.taskHistory && historyEntry.debug) {
          historyEntry.debug.responses.push({
            timestamp: Date.now(),
            content: result.text,
            usage: {
              tokensIn: result.usage?.promptTokens || 0,
              tokensOut: result.usage?.completionTokens || 0,
              cost: 0
            }
          });
          historyEntry.tokensIn += result.usage?.promptTokens || 0;
          historyEntry.tokensOut += result.usage?.completionTokens || 0;
        }

        const { object } = await generateObject({
          model,
          system: this.getSystemPrompt(),
          messages: thread.getFormattedMessages(),
          maxRetries,
          maxSteps,
          schema: input.schema,
          ...this.callSettings,
        });

        thread.addMessage('assistant', JSON.stringify(object));
        
        if (this.taskHistory && historyEntry.debug) {
          historyEntry.debug.responses.push({
            timestamp: Date.now(),
            content: JSON.stringify(object),
            usage: {
              tokensIn: 0,
              tokensOut: 0,
              cost: 0
            }
          });
          this.taskHistory.saveTask(historyEntry).catch(console.error);
        }

        return object;
      }

      if (input?.schema) {
        const result = await generateObject({
          model,
          system: this.getSystemPrompt(),
          messages: thread.getFormattedMessages(),
          maxRetries,
          maxSteps,
          schema: input.schema,
          ...this.callSettings,
        });
        
        thread.addMessage('assistant', JSON.stringify(result.object));
        
        if (this.taskHistory && historyEntry.debug) {
          historyEntry.debug.responses.push({
            timestamp: Date.now(),
            content: JSON.stringify(result.object),
            usage: {
              tokensIn: result.usage?.promptTokens || 0,
              tokensOut: result.usage?.completionTokens || 0,
              cost: 0
            }
          });
          historyEntry.tokensIn += result.usage?.promptTokens || 0;
          historyEntry.tokensOut += result.usage?.completionTokens || 0;
          this.taskHistory.saveTask(historyEntry).catch(console.error);
        }

        return result.object;
      }

      result = await generateText({
        model,
        system: this.getSystemPrompt(),
        messages: thread.getFormattedMessages(),
        tools: this.tools,
        maxSteps,
        maxRetries,
        ...this.callSettings,
      });
        
      thread.addMessage('assistant', result.text);
      
      if (this.taskHistory && historyEntry.debug) {
        historyEntry.debug.responses.push({
          timestamp: Date.now(),
          content: result.text,
          usage: {
            tokensIn: result.usage?.promptTokens || 0,
            tokensOut: result.usage?.completionTokens || 0,
            cost: 0
          }
        });
        historyEntry.tokensIn += result.usage?.promptTokens || 0;
        historyEntry.tokensOut += result.usage?.completionTokens || 0;
        this.taskHistory.saveTask(historyEntry).catch(console.error);
      }

      return result.text;
    } catch (error) {
      if (this.taskHistory && historyEntry.debug) {
        historyEntry.debug.responses.push({
          timestamp: Date.now(),
          content: error instanceof Error ? error.message : String(error),
          usage: {
            tokensIn: 0,
            tokensOut: 0,
            cost: 0
          }
        });
        // Add to tool usage for error tracking
        historyEntry.debug.toolUsage.push({
          timestamp: Date.now(),
          tool: 'task',
          params: {},
          result: error instanceof Error ? error.message : String(error),
          error: true
        });
        this.taskHistory.saveTask(historyEntry).catch(console.error);
      }
      throw error;
    }
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}

import chalk from 'chalk';
import { createAgent } from 'hataraku';
import { createOpenRouter } from "@openrouter/ai-sdk-provider"; 

// Initialize agent with Gemini Flash Lite model
async function initializeAgent() {
  // Initialize OpenRouter client with Gemini model
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY || ''
  });
  
  // Specifically use Google's fast Gemini Flash Lite model
  const model = openrouter('google/gemini-2.0-flash-lite-001');
  
  // Create a poet agent using our configuration
  return createAgent({
    name: 'Gemini Flash Poet',
    description: 'A lightning-fast poet using Google Gemini Flash Lite',
    role: 'You are a creative poet who writes beautiful, concise poems with vivid imagery.',
    model: model
  });
};

async function main() {
  console.log(chalk.cyan('\n⚡ Gemini Flash Lite Streaming Example\n'));

  try {
    // Initialize agent
    console.log(chalk.yellow('🔄 Initializing Gemini Flash Lite model...\n'));
    const agent = await initializeAgent();
    
    // Prompt for generating a poem
    const prompt = 'Write a beautiful poem (16 lines) about the speed of thought and inspiration. Use vivid imagery and metaphors.';
    
    // Start streaming
    console.log(chalk.magenta('✨ Generating poem with streaming...\n'));
    
    // Track start time for speed demonstration
    const startTime = Date.now();
    
    // Execute task with streaming
    const result = await agent.task(prompt, {stream: true});
    
    // Display streaming results
    for await (const chunk of result) {
      // Print chunk without newline to show streaming effect
      process.stdout.write(chunk);
    }
    
    // Calculate and display generation time
    const endTime = Date.now();
    const generationTime = (endTime - startTime) / 1000;
    
    console.log(chalk.cyan(`\n\n⏱️ Generation time: ${generationTime.toFixed(2)} seconds\n`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error); 
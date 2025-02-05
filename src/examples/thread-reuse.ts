import { Agent } from '../core/agent';
import { AgentConfig } from '../core/agent/types/config';
import { Thread } from '../core/thread/thread';

async function main() {
  // Create agent config with OpenRouter/Sonnet model
  const config: AgentConfig = {
    name: 'Thread Reuse Example',
    model: {
      apiProvider: 'openrouter',
      apiModelId: 'deepseek/deepseek-chat'
    },
    tools: [] // No tools needed for this example
  };

  // Create and initialize agent
  const agent = new Agent(config);
  await agent.initialize();

  // Create a thread that will be reused across tasks
  const thread = new Thread();

  // Add some context that will be available for all tasks
  thread.addContext('user_preferences', {
    language: 'English',
    format: 'concise',
    expertise_level: 'intermediate'
  });

  try {
    // First task - ask about a programming concept
    console.log('\nFirst Task - Asking a basic math question');
    const response1 = await agent.task({
      role: 'user',
      content: 'What is 2 + 2?',
      thread // Reuse the same thread
    });
    console.log('Response:', response1);

    // Second task - follow up question using context from first answer
    console.log('\nSecond Task - Following up on the explanation:\n');
    const response2 = await agent.task({
      role: 'user',
      content: 'Now add 5 to the result',
      thread // Same thread maintains conversation context
    });
    console.log('Response:', response2);

    // Third task - another follow up
    console.log('\nThird Task - One more follow up:\n');
    const response3 = await agent.task({
      role: 'user',
      content: 'Now multiply the result by 3',
      thread
    });
    console.log('Response:', response3);

    // Show the conversation history
    console.log('\nFull Conversation History:');
    thread.getMessages().forEach((msg, i) => {
      console.log(`\n[${msg.role}]: ${msg.content}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the program
main().catch(console.error); 
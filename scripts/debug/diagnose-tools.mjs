// Diagnostic script untuk tool calling di VoltAgent
import { Agent, createTool } from '@voltagent/core';
import { createOllama } from 'ollama-ai-provider-v2';
import { z } from 'zod';

console.log('🔍 Testing VoltAgent tool calling setup\n');

// Test 1: Check if createTool exists
console.log('✅ Step 1: createTool imported from @voltagent/core');
console.log('   createTool type:', typeof createTool);

// Test 2: Create a simple ping tool
const pingTool = createTool({
  name: 'ping',
  description: 'Simple ping tool to test tool calling',
  parameters: z.object({}),
  execute: async () => {
    console.log('   [TOOL EXECUTED] ping tool was called!');
    return { status: 'pong', timestamp: Date.now() };
  },
});

console.log('\n✅ Step 2: Created pingTool with createTool()');
console.log('   Tool name:', pingTool.name);
console.log('   Tool type:', typeof pingTool);

// Test 3: Create agent with tool
const ollamaInstance = createOllama({
  baseURL: 'http://localhost:11434/api',
});

const model = ollamaInstance('llama3.2');

const agent = new Agent({
  name: 'DiagnosticAgent',
  instructions: 'For EVERY user message, ALWAYS call the ping tool first before answering.',
  model,
  tools: [pingTool], // Tools must be array of createTool() results
  maxSteps: 10,
});

console.log('\n✅ Step 3: Created Agent with tools array');
console.log('   Agent name:', agent.name);

// Test 4: Try calling agent
console.log('\n🚀 Step 4: Calling agent.generateText()...\n');

const messages = [
  {
    role: 'system',
    content: 'You are a helpful assistant. ALWAYS call the ping tool for every message.'
  },
  {
    role: 'user',
    content: 'Please ping now'
  }
];

try {
  const result = await agent.generateText(messages, {
    temperature: 0.0,
    maxSteps: 10,
  });

  console.log('\n✅ Agent response:', {
    textLength: result.text ? (await result.text).length : 0,
    hasToolResults: !!result.toolResults,
    toolCount: result.toolResults?.length || 0,
  });

  if (result.toolResults && result.toolResults.length > 0) {
    console.log('\n🎉 SUCCESS: Tool was called!');
    result.toolResults.forEach((tr, idx) => {
      console.log(`   [${idx + 1}] ${tr.toolName}: ${JSON.stringify(tr.output)}`);
    });
  } else {
    console.log('\n❌ FAIL: Tool was NOT called despite instructions');
    const text = await result.text;
    console.log('   Agent response:', text.substring(0, 200));
  }
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}

const axios = require('axios');

const API_URL = 'http://127.0.0.1:11434/api/chat'; // Local Ollama endpoint

async function testOllama() {
  const data = {
    model: 'llama3.2:latest', // Change to your local model name if different
    messages: [
      { role: 'system', content: 'You are an NPC in a fantasy game. Answer only based on game world context.' },
      { role: 'user', content: 'Hi, How are you' }
    ],
    stream: false // Set to true for streaming responses
  };

  try {
    const response = await axios.post(API_URL, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const reply = response.data.message.content.trim();
    console.log('Ollama Reply:', reply);
  } catch (error) {
    console.error('Ollama Error:', error.response?.data || error.message);
  }
}

testOllama();

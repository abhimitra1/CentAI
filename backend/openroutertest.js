const axios = require('axios');

const API_KEY = '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'; // Replace securely in production
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function testOpenRouter() {
  const data = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are an NPC in a fantasy game. Answer only based on game world context.' },
      { role: 'user', content: 'Hi, How are you' }
    ],
    temperature: 0.7
  };

  try {
    const response = await axios.post(API_URL, data, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const reply = response.data.choices[0].message.content.trim();
    console.log('OpenRouter Reply:', reply);
  } catch (error) {
    console.error('OpenRouter Error:', error.response?.data || error.message);
  }
}

testOpenRouter();

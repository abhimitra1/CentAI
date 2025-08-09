
const OpenAI = require('openai');
// Use require to import dummy.json directly for serverless compatibility

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const dummyData = require('./data/dummy.json');
const facultyData = require('./data/cutm_faculty_partial.json');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: dummyData.system_prompt || 'You are CentAI, the university assistant.' },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 1000,
      temperature: 0.7
    });
    const reply = completion.choices[0].message.content;
    console.log('OpenAI response:', reply);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Error in chat API:', error);
    return res.status(500).json({ error: error.message });
  }
};

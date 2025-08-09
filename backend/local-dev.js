// Local development server script
// This script runs ollama-server.js for local development only

console.log('Starting CentAI local development server with Ollama...');
console.log('Note: This script should only be used for local development');

// Set environment variable to use Ollama
process.env.USE_OLLAMA = 'true';

// Import and run the main server
require('./index.js');

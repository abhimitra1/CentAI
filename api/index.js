// This file serves as the API entry point for Vercel
// It imports and uses the Express app from the backend folder

// Import the Express app
const app = require('../backend/index.js');

// Export a handler for Vercel
module.exports = app;

# CentAI

A full-stack AI chatbot project with React frontend and Node.js backend. Features Google login and OpenAI API integration.

## Structure
- `frontend/`: React app for user interface and Google authentication
- `backend/`: Node.js server for authentication, session management, and OpenAI API proxy

## Setup

### Backend
1. Add your OpenAI API key to a `.env` file in `backend/`:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   SESSION_SECRET=your_session_secret_here
   ```
2. Run the backend server:
   ```sh
   # Production mode (using OpenAI)
   npm start

   # Local development mode (using Ollama)
   npm run dev

   # Local development with auto-restart on changes
   npm run dev:watch
   ```

### Development vs Production
- **Local Development**: Uses Ollama (local LLM) for AI responses
  - Requires [Ollama](https://ollama.com/) installed and running locally
  - Uses `llama3.2:latest` model by default
  - Start with `npm run dev` or `npm run dev:watch`

- **Production**: Uses OpenAI for AI responses
  - Requires valid `OPENAI_API_KEY` in environment variables
  - Uses `gpt-3.5-turbo` model
  - Start with `npm start` or deploy to Vercel
  - Automatically used in Vercel deployments
   ```sh
   cd backend
   node index.js
   ```

### Frontend
1. Start the React app:
   ```sh
   cd frontend
   npm start
   ```

## Features
- Google login (OAuth)
- Chatbot powered by OpenAI
- Secure session management

---
Replace placeholder values in `.env` with your actual credentials.

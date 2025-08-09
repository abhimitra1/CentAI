// MongoDB setup
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();
const mongoUri = process.env.MONGO_URI || '';
if (mongoUri) {
  mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      console.log('Connected to MongoDB with Mongoose');
    })
    .catch(err => console.error('Mongoose connection error:', err));
}

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const OpenAI = require('openai');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Added for Ollama support

// Initialize OpenAI with API key if in production
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Load dummy.json data for context
let dummyData = {};
try {
  const dummyPath = path.join(__dirname, 'data', 'dummy.json');
  dummyData = JSON.parse(fs.readFileSync(dummyPath, 'utf8'));
} catch (err) {
  console.error('Failed to load dummy.json:', err);
}

const app = express();
// CORS must be before session and routes
// Dynamic origin based on environment
const allowedOrigins = ['http://localhost:3000'];
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set secure to false for local development
}));
app.use(passport.initialize());
app.use(passport.session());

// Configure Google OAuth strategy (after imports and dotenv)
// Determine base URL for callbacks
let baseUrl = '';
if (process.env.VERCEL_URL) {
  baseUrl = `https://${process.env.VERCEL_URL}`;
} else if (process.env.FRONTEND_URL) {
  baseUrl = process.env.FRONTEND_URL;
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: baseUrl ? `${baseUrl}/auth/google/callback` : '/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), async (req, res) => {
  // Store user info using Mongoose User model (upsert)
  const googleId = req.user.id;
  const email = req.user.emails?.[0]?.value || '';
  const name = req.user.displayName || '';
  try {
    const user = await User.findOneAndUpdate(
      { googleId },
      { name, email },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Upserted user: ${user.googleId} (${user.email}, ${user.name})`);
  } catch (err) {
    console.error('Mongoose user upsert error:', err);
  }
  // Issue a JWT for the logged-in user
  const token = jwt.sign(
    { id: googleId, email, name },
    process.env.JWT_SECRET || 'dev_jwt_secret',
    { expiresIn: '7d' }
  );
  // Determine frontend URL for redirection
  let frontendUrl = 'http://localhost:3000';
  if (process.env.FRONTEND_URL) {
    frontendUrl = process.env.FRONTEND_URL;
  } else if (process.env.VERCEL_URL) {
    frontendUrl = `https://${process.env.VERCEL_URL}`;
  }

  // Redirect back to frontend with token in fragment (avoids logs and referer leakage)
  res.redirect(`${frontendUrl}/#token=${token}`);
});

// Middleware to read JWT from Authorization header and attach req.user if valid
function withJwt(req, _res, next) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/i);
  if (m) {
    try {
      req.user = jwt.verify(m[1], process.env.JWT_SECRET || 'dev_jwt_secret');
    } catch {}
  }
  next();
}

app.get('/api/user', withJwt, (req, res) => {
  res.json(req.user || null);
});


app.post('/api/chat', withJwt, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { message } = req.body;
    // Build system prompt with dummy.json data
    let SYSTEM_PROMPT = (dummyData.system_prompt || '') + '\n';
    SYSTEM_PROMPT += '\nI have details about departments, teachers, buildings, hostels, and clubs at Centurion University. If you would like to know more about any of these, just ask! After answering your question, I will offer to share more details if you are interested.';

    // Add structured info for context
    SYSTEM_PROMPT += '\n\nDepartments:\n';
    dummyData.departments?.forEach(dep => {
      SYSTEM_PROMPT += `- ${dep.name} (HOD: ${dep.hod}, Email: ${dep.email}, Phone: ${dep.phone})\n`;
    });
    SYSTEM_PROMPT += '\nTeachers:\n';
    dummyData.teachers?.forEach(teacher => {
      SYSTEM_PROMPT += `- ${teacher.name} (${teacher.department}, Email: ${teacher.email}, Phone: ${teacher.phone})\n`;
    });
    SYSTEM_PROMPT += '\nBuildings:\n';
    dummyData.buildings?.forEach(bldg => {
      SYSTEM_PROMPT += `- ${bldg.name} (Location: ${bldg.location}, Departments: ${bldg.departments?.join(', ')})\n`;
    });
    SYSTEM_PROMPT += '\nHostels:\n';
    dummyData.hostels?.forEach(hostel => {
      SYSTEM_PROMPT += `- ${hostel.name} (Warden: ${hostel.warden}, Phone: ${hostel.phone}, Email: ${hostel.email}, Capacity: ${hostel.capacity})\n`;
    });
    SYSTEM_PROMPT += '\nClubs:\n';
    dummyData.clubs?.forEach(club => {
      SYSTEM_PROMPT += `- ${club.name} (${club.category}, Coordinator: ${club.faculty_coordinator}, Contact: ${club.contact}, Email: ${club.email})\n`;
    });

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message }
    ];

    let reply;

    // Check for local development vs production
    // NODE_ENV is typically 'production' in Vercel and undefined or 'development' locally
    const isProduction = process.env.NODE_ENV === 'production';
    const useOpenAI = isProduction || !process.env.USE_OLLAMA;

    if (useOpenAI && openai) {
      // Use OpenAI in production or when explicitly configured
      console.log('Using OpenAI API...');
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 1000,
        temperature: 0.7
      });
      reply = completion.choices[0].message.content;
      console.log('OpenAI response:', reply);
    } else {
      // Use Ollama for local development when available
      console.log('Using local Ollama API...');
      try {
        const ollamaPayload = {
          model: 'llama3.2:latest',
          messages,
          stream: false
        };
        const ollamaRes = await axios.post('http://127.0.0.1:11434/api/chat', ollamaPayload, {
          headers: { 'Content-Type': 'application/json' }
        });
        reply = ollamaRes.data.message.content;
        console.log('Ollama response:', reply);
      } catch (ollamaErr) {
        console.error('Ollama error:', ollamaErr.message);
        return res.status(500).json({ error: 'Ollama service unavailable', details: ollamaErr.message });
      }
    }

    res.json({ reply });
  } catch (err) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ error: err.message, details: err });
  }
}); // <-- This closes the app.post('/api/chat', ...)

// Only start the server if we're not in a serverless environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(5001, () => console.log('Backend running on http://localhost:5001'));
}

// Export the Express app for serverless environments
module.exports = app;

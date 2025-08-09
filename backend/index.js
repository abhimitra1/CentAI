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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Reuse the same chat handler used in serverless API for deterministic JSON answers
const chatHandler = require('./api/chat');

// Load half-data.json for context
let halfData = {};
try {
  const dataPath = path.join(__dirname, 'data', 'half-data.json');
  halfData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (err) {
  console.error('Failed to load half-data.json:', err);
}

const app = express();
// CORS must be before session and routes
app.use(cors({
  origin: 'http://localhost:3000',
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
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
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
  // Redirect back to frontend with token in fragment (avoids logs and referer leakage)
  res.redirect(`http://localhost:3000/#token=${token}`);
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
  // Delegate to the unified JSON-driven handler so responses match the smoke test
  return chatHandler(req, res);
}); // <-- This closes the app.post('/api/chat', ...)

app.listen(5001, () => console.log('Backend running on http://localhost:5001'));

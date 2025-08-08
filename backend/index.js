// MongoDB setup
const { MongoClient } = require('mongodb');
const mongoUri = process.env.MONGO_URI || '';
let db;
if (mongoUri) {
  MongoClient.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
      db = client.db();
      console.log('Connected to MongoDB');
    })
    .catch(err => console.error('MongoDB connection error:', err));
}
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const OpenAI = require('openai');
const jwt = require('jsonwebtoken');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  // Issue a JWT for the logged-in user
  const token = jwt.sign(
    { id: req.user.id, email: req.user.emails?.[0]?.value },
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
  try {
    const { message } = req.body;
    const SYSTEM_PROMPT =
      'You are CentAI, the official Centurion University onboarding assistant. Only answer questions in the context of Centurion University of Technology and Management (CUTM), its departments, teachers, buildings, hostels, clubs, and student life. Do not provide information about other universities or general topics unless they relate to Centurion University. Keep your answers short and crisp.';
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message }
    ];
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 120,
      temperature: 0.7
    });
    let reply = completion.choices[0].message.content;
    if (reply.length > 300) reply = reply.slice(0, 300) + '...';
    // Save chat to MongoDB
    if (db && req.user && req.user.id) {
      await db.collection('chats').insertOne({
        userId: req.user.id,
        timestamp: new Date(),
        question: message,
        answer: reply
      });
    }
  console.log('OpenAI response:', reply);
    res.json({ reply });
  } catch (err) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ error: err.message, details: err });
  }
}); // <-- This closes the app.post('/api/chat', ...)

app.listen(5001, () => console.log('Backend running on http://localhost:5001'));

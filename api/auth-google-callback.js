const { connectToDatabase } = require('./utils/database');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is missing' });
    }

    // Exchange code for tokens
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    
    // Get the host from the request headers or fall back to environment variable
    const host = req.headers.host || process.env.VERCEL_URL || 'cent-ai.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/auth-google-callback`;
    
    // Log the redirect URI for debugging
    console.log('Callback Redirect URI:', redirectUri);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google OAuth credentials not configured' });
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const { access_token, id_token } = tokenResponse.data;

    // Get user info from Google
    const userInfoResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const { sub: googleId, name, email } = userInfoResponse.data;

    try {
      // Connect to database
      console.log('Connecting to MongoDB...');
      await connectToDatabase();
      console.log('Connected to MongoDB successfully');

      // Find or create user
      console.log('Finding or creating user for:', email);
      const user = await User.findOneAndUpdate(
        { googleId },
        { googleId, name, email },
        { upsert: true, new: true }
      );
      console.log('User processed successfully');

      // Create JWT token
      const token = jwt.sign(
        { userId: user._id, googleId, name, email },
        process.env.SESSION_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      // Redirect back to frontend with token
      // Use the same host for frontend redirect
      const frontendUrl = process.env.NODE_ENV === 'production'
        ? `${protocol}://${host}`
        : 'http://localhost:3000';
      
      console.log('Frontend redirect URL:', frontendUrl);
      
      res.setHeader('Location', `${frontendUrl}/#token=${token}`);
      return res.status(302).end();
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      return res.status(500).json({ error: 'Database operation failed', details: dbError.message });
    }

    // This code won't be reached because we return in both success and error cases above
    return res.status(302).end();
  } catch (error) {
    console.error('Google OAuth error:', error);
    return res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
};

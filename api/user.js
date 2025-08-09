const { connectToDatabase } = require('./utils/database');
const User = require('./models/User');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token format' });
    }

    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'secret');
      
      // Connect to database
      await connectToDatabase();
      
      // Find user in the database
      const user = await User.findOne({ googleId: decoded.googleId });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Return user data (without sensitive information)
      return res.status(200).json({
        id: user._id,
        name: user.name,
        email: user.email
      });
    } catch (error) {
      // Token verification failed
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
  } catch (error) {
    console.error('Error in /api/user:', error);
    return res.status(500).json({ error: error.message });
  }
};

// This is a redirect endpoint for Google OAuth
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

  // In a serverless environment, OAuth requires a different approach
  // We would typically use a service like NextAuth.js

  // For now, we'll redirect to Google's OAuth URL with your client ID
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  
  // Get the host from the request headers or fall back to environment variable
  const host = req.headers.host || process.env.VERCEL_URL || 'cent-ai.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/auth-google-callback`;
  
  // Log the redirect URI for debugging
  console.log('Redirect URI:', redirectUri);

  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google client ID not configured' });
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile email`;

  // Redirect to Google OAuth
  res.setHeader('Location', googleAuthUrl);
  return res.status(302).end();
};

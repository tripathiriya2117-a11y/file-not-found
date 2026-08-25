import { supabaseAdmin } from '../config/supabase.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Please sign in.',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No bearer token provided.',
      });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session token.',
        details: error?.message,
      });
    }

    // Attach authenticated user and token to request
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Authentication middleware error:', err);
    return res.status(500).json({
      error: 'AuthenticationError',
      message: 'Failed to authenticate user request.',
    });
  }
}

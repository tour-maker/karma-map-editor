import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../utils/adminJwt.js';

const ADMIN_RENEW_AFTER_SECONDS = 24 * 60 * 60;

function verifyBearer(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export const requireAdmin = (req, res, next) => {
  const decoded = verifyBearer(req);
  if (!decoded || decoded.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized — admin token required' });
  }
  // Sliding session: an admin who is actively working gets a fresh 7-day token once the
  // current one is over a day old. The client stores it from this header.
  if (decoded.iat && Date.now() / 1000 - decoded.iat > ADMIN_RENEW_AFTER_SECONDS) {
    res.set('X-Renewed-Token', jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' }));
  }
  next();
};

export const requireUser = (req, res, next) => {
  const decoded = verifyBearer(req);
  if (!decoded || decoded.role !== 'user') {
    return res.status(401).json({ error: 'Unauthorized — please sign in' });
  }
  req.userId = decoded.id;
  req.username = decoded.username;
  next();
};

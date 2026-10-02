import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../utils/adminJwt.js';

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

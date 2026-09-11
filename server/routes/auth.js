import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'karma-jwt-2024-secure-admin-key-realtors';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'karma@2024';

// POST /api/auth/login
// Admin login — unrelated to viewer accounts below.
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// POST /api/auth/verify
// Verifies an admin token (used by the admin overlay on page load).
router.post('/verify', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ valid: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(401).json({ valid: false });
    res.json({ valid: true });
  } catch {
    res.status(401).json({ valid: false });
  }
});

// ─── Viewer accounts ────────────────────────────────────────────────────────

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      return res.status(409).json({ error: 'That username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username: normalizedUsername, passwordHash });

    const token = jwt.sign({ id: user._id.toString(), username: user.username, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, username: user.username });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/user-login
router.post('/user-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user._id.toString(), username: user.username, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: user.username });
  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/user-verify
// Verifies a viewer token (used to restore the session on page load).
router.post('/user-verify', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ valid: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user') return res.status(401).json({ valid: false });
    res.json({ valid: true, username: decoded.username });
  } catch {
    res.status(401).json({ valid: false });
  }
});

export default router;

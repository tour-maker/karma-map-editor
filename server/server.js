import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import submissionRoutes from './routes/submissions.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import sheetsRoutes from './routes/sheets.js';
import shareRoutes from './routes/share.js';
import userRoutes from './routes/users.js';
import areaEventRoutes from './routes/areaEvents.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
// Expose the renewed-admin-token header so the browser app can read it.
app.use(cors({ exposedHeaders: ['X-Renewed-Token'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/area-events', areaEventRoutes);
app.use('/share', shareRoutes);

// MongoDB Connection
// MONGODB_URI must come from the environment (server/.env on the VPS) — there is
// deliberately no hardcoded fallback here. A previous version of this file fell back
// to a stray personal MongoDB Atlas account when the env var was missing, which meant
// production silently ran against a database nobody here actually owned or controlled.
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('FATAL: MONGODB_URI is not set. Refusing to start with no database configured.');
  console.error('Set MONGODB_URI in server/.env — see .env.example.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import submissionRoutes from './routes/submissions.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import sheetsRoutes from './routes/sheets.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/sheets', sheetsRoutes);

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sleepyraj10_db_user:FWRjDCAij8ynvAEU@test-0.opmgpmd.mongodb.net/?appName=test-0';

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

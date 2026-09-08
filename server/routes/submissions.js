import express from 'express';
import Submission from '../models/Submission.js';
import { appendApprovedSubmission, removeSubmissionFromSheet } from '../sheetsHelper.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/submissions
// @desc    Submit a new polygon from the viewer panel
router.post('/', async (req, res) => {
  try {
    const { loginId, password, coordinates, ...details } = req.body;

    if (!loginId || !password || !coordinates || coordinates.length === 0) {
      return res.status(400).json({ error: 'Missing required fields or coordinates' });
    }

    const newSubmission = new Submission({
      loginId,
      password,
      coordinates,
      ...details
    });

    await newSubmission.save();
    res.status(201).json({ message: 'Submission successful', submission: newSubmission });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/submissions/stats
// @desc    Get counts of submissions by status (Admin only)
router.get('/stats', async (req, res) => {
  try {
    const stats = await Submission.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const formattedStats = { pending: 0, approved: 0, rejected: 0 };
    stats.forEach(stat => {
      if (formattedStats[stat._id] !== undefined) {
        formattedStats[stat._id] = stat.count;
      }
    });
    res.json(formattedStats);
  } catch (error) {
    console.error('Fetch stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/submissions
// @desc    Get submissions, optionally filtered by status (Admin only)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const submissions = await Submission.find(filter).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    console.error('Fetch submissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/submissions/:id/approve
// @desc    Approve a submission (Admin only — requires JWT)
router.post('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    
    submission.status = 'approved';
    await submission.save();

    // Sync to Google Sheets via service account (no OAuth needed)
    try {
      const sheetId = await appendApprovedSubmission(submission);
      console.log(`[Approve] Synced to sheet with id: ${sheetId}`);
      res.json({ message: 'Submission approved and synced to Google Sheet', submission, sheetId });
    } catch (sheetErr) {
      console.error('[Approve] Sheet sync failed:', sheetErr.message);
      // Still return success for the approval itself, just note sheet sync failed
      res.json({ message: 'Submission approved (sheet sync failed)', submission, sheetError: sheetErr.message });
    }

  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/submissions/:id
// @desc    Reject a submission (Admin only — requires JWT)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    
    // If it was previously approved, we must remove it from the Google Sheet
    if (submission.status === 'approved') {
      try {
        await removeSubmissionFromSheet(submission._id);
      } catch (sheetErr) {
        console.error('[Reject] Failed to remove from sheet:', sheetErr);
        // We continue with rejection even if sheet removal fails, but we can log it.
      }
    }

    submission.status = 'rejected';
    await submission.save();

    res.json({ message: 'Submission rejected', submission });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

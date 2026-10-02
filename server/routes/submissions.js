import express from 'express';
import Submission from '../models/Submission.js';
import { appendApprovedSubmission, removeSubmissionFromSheet } from '../sheetsHelper.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/submissions
// @desc    Submit a new polygon from the viewer panel (requires a signed-in viewer account)
router.post('/', requireUser, async (req, res) => {
  try {
    const { coordinates, ...details } = req.body;

    if (!coordinates || coordinates.length === 0) {
      return res.status(400).json({ error: 'Missing polygon coordinates' });
    }

    const newSubmission = new Submission({
      userId: req.userId,
      username: req.username,
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

// @route   GET /api/submissions/mine
// @desc    Get the signed-in viewer's own submissions, across all statuses
router.get('/mine', requireUser, async (req, res) => {
  try {
    const submissions = await Submission.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    console.error('Fetch my submissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/submissions/stats
// @desc    Get counts of submissions by status (Admin only)
router.get('/stats', requireAdmin, async (req, res) => {
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
router.get('/', requireAdmin, async (req, res) => {
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
    let sheetId;
    try {
      sheetId = await appendApprovedSubmission(submission);
      submission.sheetId = sheetId;
      await submission.save();
      console.log(`[Approve] Synced to sheet with id: ${sheetId}`);
      res.json({ message: 'Submission approved and synced to Google Sheet', submission, sheetId });
    } catch (sheetErr) {
      console.error('[Approve] Sheet sync failed:', sheetErr.message);
      if (sheetId) {
        try {
          await removeSubmissionFromSheet(sheetId);
        } catch (cleanupErr) {
          console.error('[Approve] Failed to clean up unlinked sheet row:', cleanupErr.message);
        }
      }
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
        if (!submission.sheetId) throw new Error('Approved request is missing its Google Sheets row ID.');
        await removeSubmissionFromSheet(submission.sheetId);
      } catch (sheetErr) {
        console.error('[Reject] Failed to remove from sheet:', sheetErr);
        return res.status(502).json({ error: 'Could not safely remove the approved polygon from Google Sheets. The request was left unchanged.' });
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

// @route   PUT /api/submissions/:id
// @desc    Edit a submission's property details (Admin only — requires JWT).
//          Only the descriptive fields are editable here — userId, username,
//          coordinates and status are left alone (status changes go through
//          the dedicated approve/reject routes above).
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const EDITABLE_FIELDS = [
      'tp', 'op', 'fp', 'area', 'areaUnit', 'location', 'parentLocation',
      'landmark', 'type', 'remarks', 'partyName', 'partyPhone', 'brokerName', 'brokerPhone'
    ];
    for (const field of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        submission[field] = req.body[field];
      }
    }

    await submission.save();
    res.json({ message: 'Submission updated', submission });
  } catch (error) {
    console.error('Edit submission error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/submissions/:id/permanent
// @desc    Permanently delete a submission (Admin only — requires JWT). Unlike
//          DELETE /:id (which rejects/soft-removes it), this actually removes
//          the record — used from the admin Users panel to clean up a
//          specific polygon a user submitted. If it was approved, it's also
//          removed from the Google Sheet first.
router.delete('/:id/permanent', requireAdmin, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    if (submission.status === 'approved') {
      try {
        if (!submission.sheetId) throw new Error('Approved request is missing its Google Sheets row ID.');
        await removeSubmissionFromSheet(submission.sheetId);
      } catch (sheetErr) {
        console.error('[Permanent Delete] Failed to remove from sheet:', sheetErr);
        return res.status(502).json({ error: 'Could not safely remove the approved polygon from Google Sheets. The request was left unchanged.' });
      }
    }

    await submission.deleteOne();
    res.json({ message: 'Submission permanently deleted' });
  } catch (error) {
    console.error('Permanent delete submission error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/submissions/:id/mine
// @desc    Permanently delete the signed-in viewer's own rejected submission
router.delete('/:id/mine', requireUser, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    if (String(submission.userId) !== String(req.userId)) {
      return res.status(403).json({ error: 'You can only delete your own submissions' });
    }
    if (submission.status !== 'rejected') {
      return res.status(400).json({ error: 'Only rejected submissions can be deleted' });
    }

    await submission.deleteOne();
    res.json({ message: 'Submission deleted' });
  } catch (error) {
    console.error('Delete own submission error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

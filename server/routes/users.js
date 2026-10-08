import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/users
// @desc    List all registered (non-deleted) users with aggregated submission
//          stats — one aggregation pipeline rather than a query per user, so
//          this stays fast as the user base grows. (Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await User.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: 'submissions',
          localField: '_id',
          foreignField: 'userId',
          as: 'submissions'
        }
      },
      {
        $addFields: {
          totalProperties: { $size: '$submissions' },
          approvedCount: {
            $size: { $filter: { input: '$submissions', cond: { $eq: ['$$this.status', 'approved'] } } }
          },
          pendingCount: {
            $size: { $filter: { input: '$submissions', cond: { $eq: ['$$this.status', 'pending'] } } }
          },
          rejectedCount: {
            $size: { $filter: { input: '$submissions', cond: { $eq: ['$$this.status', 'rejected'] } } }
          },
          lastSubmissionAt: { $max: '$submissions.createdAt' }
        }
      },
      {
        $project: {
          username: 1,
          email: 1,
          firstName: 1,
          lastName: 1,
          createdAt: 1,
          isBlocked: 1,
          locations: '$submissions.parentLocation',
          types: '$submissions.type',
          totalProperties: 1,
          approvedCount: 1,
          pendingCount: 1,
          rejectedCount: 1,
          lastSubmissionAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/users/:id/submissions
// @desc    Full submission list for one user (drill-down view). (Admin only)
router.get('/:id/submissions', requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const submissions = await Submission.find({ userId: req.params.id }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    console.error('Fetch user submissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Soft-delete a user account. Their existing submissions are left as-is
//          (they belong to the project/sheet, not to the login) — only the
//          account is deactivated, and it can no longer sign in. (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PATCH /api/users/:id/block
// @desc    Block or unblock a user ({ blocked: true|false }). A blocked user cannot sign in
//          and any live session stops working on its next request. (Admin only)
router.patch('/:id/block', requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const blocked = req.body?.blocked !== false;
    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.isBlocked = blocked;
    user.blockedAt = blocked ? new Date() : null;
    await user.save();
    res.json({ message: blocked ? 'User blocked' : 'User unblocked', isBlocked: blocked });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

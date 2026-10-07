import express from 'express';
import AreaEvent from '../models/AreaEvent.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const text = (value, max = 120) => String(value ?? '').trim().slice(0, max);

// @route   POST /api/area-events
// @desc    Record one admin change to the area structure. (Admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { action, area, parent, to, toParent, plots } = req.body || {};
    const cleanPlots = (Array.isArray(plots) ? plots : []).slice(0, 2000)
      .map(plot => ({ id: text(plot?.id, 80), fromParent: text(plot?.fromParent), fromLocation: text(plot?.fromLocation) }))
      .filter(plot => plot.id);
    const event = await AreaEvent.create({
      action,
      area: text(area),
      parent: text(parent),
      to: text(to),
      toParent: text(toParent),
      plots: cleanPlots,
      by: 'admin'
    });
    res.status(201).json(event);
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ error: 'Invalid area event' });
    console.error('Create area event error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/area-events?actions=delete-area,delete-sub,rehome
// @desc    Newest events first (capped). (Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const actions = text(req.query.actions, 200).split(',').map(a => a.trim()).filter(Boolean);
    const filter = actions.length ? { action: { $in: actions } } : {};
    const events = await AreaEvent.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json(events);
  } catch (error) {
    console.error('Fetch area events error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

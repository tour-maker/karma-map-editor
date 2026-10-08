import express from 'express';
import Category, { DEFAULT_CATEGORIES } from '../models/Category.js';
import Submission from '../models/Submission.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const cleanName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
const keyOf = (name) => name.toLowerCase();
const isColor = (value) => /^#[0-9a-fA-F]{6}$/.test(String(value ?? ''));
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const publicShape = (category) => ({
  _id: category._id,
  name: category.name,
  color: category.color,
  aliases: category.aliases || [],
  sortOrder: category.sortOrder
});

// @route   GET /api/categories
// @desc    The category list everyone's app uses (public). The first call seeds the built-in list.
router.get('/', async (req, res) => {
  try {
    if ((await Category.estimatedDocumentCount()) === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, key: keyOf(c.name), sortOrder: i })), { ordered: false })
        .catch(() => {});
    }
    const categories = await Category.find().sort({ sortOrder: 1, createdAt: 1 });
    res.json(categories.map(publicShape));
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/categories
// @desc    Add a category. (Admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Please enter a category name' });
    if (!isColor(req.body?.color)) return res.status(400).json({ error: 'Please pick a colour' });
    if (await Category.exists({ $or: [{ key: keyOf(name) }, { aliases: new RegExp(`^${escapeRegex(name)}$`, 'i') }] })) {
      return res.status(409).json({ error: `"${name}" already exists` });
    }
    const last = await Category.findOne().sort({ sortOrder: -1 });
    const category = await Category.create({
      name, key: keyOf(name), color: req.body.color.toLowerCase(), sortOrder: (last?.sortOrder ?? -1) + 1
    });
    res.status(201).json(publicShape(category));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That category already exists' });
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/categories/:id
// @desc    Rename and/or recolour a category. A rename keeps the old name as an alias and
//          updates the type on every request that used it. (Admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const oldName = category.name;
    if (req.body?.color !== undefined) {
      if (!isColor(req.body.color)) return res.status(400).json({ error: 'Please pick a valid colour' });
      category.color = req.body.color.toLowerCase();
    }
    if (req.body?.name !== undefined) {
      const name = cleanName(req.body.name);
      if (!name) return res.status(400).json({ error: 'Please enter a category name' });
      if (keyOf(name) !== category.key) {
        if (await Category.exists({ _id: { $ne: category._id }, $or: [{ key: keyOf(name) }, { aliases: new RegExp(`^${escapeRegex(name)}$`, 'i') }] })) {
          return res.status(409).json({ error: `"${name}" already exists` });
        }
        category.aliases = Array.from(new Set([...(category.aliases || []).filter(a => keyOf(a) !== keyOf(name)), oldName]));
      }
      category.name = name;
      category.key = keyOf(name);
    }
    await category.save();

    let renamedSubmissions = 0;
    if (category.name !== oldName) {
      const names = Array.from(new Set([oldName, ...(category.aliases || [])]));
      const result = await Submission.updateMany(
        { type: { $in: names.map(n => new RegExp(`^${escapeRegex(n)}$`, 'i')) } },
        { $set: { type: category.name } }
      );
      renamedSubmissions = result.modifiedCount || 0;
    }
    res.json({ category: publicShape(category), previousName: oldName, renamedSubmissions });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That category already exists' });
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

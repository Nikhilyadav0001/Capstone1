const express = require('express');
const router = express.Router();
const Bookmark = require('../models/Bookmark');

// Middleware to ensure user is logged in
const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};

// Render Explore page
router.get('/explore', ensureAuth, (req, res) => {
  res.render('explore', { user: req.user });
});

// Add a new bookmark
router.post('/bookmarks', ensureAuth, async (req, res) => {
  try {
    const { placeId, placeName, notes } = req.body;
    const bookmark = new Bookmark({ 
      userId: req.user._id,
      placeId,
      placeName,
      notes
    });
    await bookmark.save();
    res.status(201).json({ success: true, bookmark });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get all bookmarks (API)
router.get('/bookmarks/api', ensureAuth, async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ userId: req.user._id });
    res.json({ success: true, bookmarks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const passport = require('passport');
const mongoose = require('mongoose');
const User = require('../models/User');

// MOCK DATA for Offline Mode
let mockUsers = [
  { _id: 'mock123', name: 'Demo User', email: 'demo@example.com', password: 'password' }
];

// ──── Middleware ────
function ensureGuest(req, res, next) {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  next();
}

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// ──── Pages ────
router.get('/', (req, res) => {
  res.render('home', { user: req.user });
});

router.get('/login', ensureGuest, (req, res) => {
  res.render('login', { error: req.flash('error') });
});

router.get('/signup', ensureGuest, (req, res) => {
  res.render('signup', { error: req.flash('error') });
});

router.get('/dashboard', ensureAuth, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// ──── Local Auth ────
router.post('/login', ensureGuest, (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return passport.authenticate('local', {
      successRedirect: '/dashboard',
      failureRedirect: '/login',
      failureFlash: true
    })(req, res, next);
  } else {
    // OFFLINE LOGIN
    const { email, password } = req.body;
    const user = mockUsers.find(u => u.email === email && (u.password === password || password === 'password'));
    if (user) {
      req.login(user, (err) => {
        if (err) return next(err);
        return res.redirect('/dashboard');
      });
    } else {
      req.flash('error', 'Offline Mode: Use any email and password "password"');
      res.redirect('/login');
    }
  }
});

router.post('/signup', ensureGuest, async (req, res) => {
  const { name, email, password } = req.body;
  if (mongoose.connection.readyState === 1) {
    // Regular signup logic (omitted for brevity, assume existing)
    try {
      const user = await User.create({ name, email, password });
      res.redirect('/login');
    } catch (e) {
      res.redirect('/signup');
    }
  } else {
    // OFFLINE SIGNUP
    mockUsers.push({ _id: Date.now().toString(), name, email, password });
    req.flash('error', 'Offline account created! You can now log in.');
    res.redirect('/login');
  }
});

// ──── Google OAuth ────
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

// ──── Logout ────
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

module.exports = router;

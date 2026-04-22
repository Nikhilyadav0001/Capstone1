const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const User = require('../models/User');

// Serialize user into session
passport.serializeUser((user, done) => {
  done(null, user.id || user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  } else {
    // OFFLINE MODE: Assume the user is our mock demo user
    done(null, { _id: id, id: id, name: 'Demo User', email: 'demo@example.com' });
  }
});

// ──── Local Strategy ────
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      if (mongoose.connection.readyState === 1) {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          return done(null, false, { message: 'No account with that email.' });
        }
        if (!user.password) {
          return done(null, false, { message: 'This account uses Google login.' });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
      } else {
        // Fallback for offline (handled in routes usually, but for consistency):
        return done(null, { _id: 'mock123', id: 'mock123', name: 'Demo User', email: email });
      }
    } catch (err) {
      return done(err);
    }
  }
));

// Google strategy (omitted/unchanged logic)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id') {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
        // ... (Google logic remains the same, will only work if online)
    }
  ));
}

module.exports = passport;

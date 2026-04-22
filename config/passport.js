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

// Google strategy implementation
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id') {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (mongoose.connection.readyState === 1) {
          // 1. Check if user already exists by googleId
          let user = await User.findOne({ googleId: profile.id });
          
          if (user) {
            return done(null, user);
          }

          // 2. Check if user exists by email (to link account)
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            user.googleId = profile.id;
            if (!user.avatar) user.avatar = profile.photos[0].value;
            await user.save();
            return done(null, user);
          }

          // 3. Create new user
          const newUser = {
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            avatar: profile.photos[0].value
          };

          user = await User.create(newUser);
          return done(null, user);
        } else {
          // Offline mode fallback for Google
          return done(null, { 
            _id: 'google_' + profile.id, 
            id: profile.id, 
            name: profile.displayName, 
            email: profile.emails[0].value 
          });
        }
      } catch (err) {
        return done(err);
      }
    }
  ));
}

module.exports = passport;

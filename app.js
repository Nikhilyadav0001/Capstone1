require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('express-flash');
const passport = require('./config/passport');

// Verify Environment Variables
const keys = {
  UNSPLASH: !!process.env.UNSPLASH_ACCESS_KEY,
  GEMINI: !!process.env.GEMINI_API_KEY,
  SESSION: !!process.env.SESSION_SECRET
};

console.log('--- 🛡️  Service Status ---');
console.log(`Unsplash Key: ${keys.UNSPLASH ? '✅ Loaded' : '❌ Missing'}`);
console.log(`Gemini Key:   ${keys.GEMINI ? '✅ Loaded' : '❌ Missing'}`);
console.log(`Session Sec:  ${keys.SESSION ? '✅ Loaded' : '❌ Missing'}`);
console.log('-------------------------');

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const travelRoutes = require('./routes/travel');
const placesRoutes = require('./routes/places');

const photoService = require('./services/photoService');
const aiService = require('./services/aiService');

const app = express();
const PORT = process.env.PORT || 3000;

// ──── View engine ────
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// ──── Middleware ────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ──── Session ────
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ──── Passport ────
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// ──── Health Check Route ────
app.get('/health', async (req, res) => {
  const [unsplash, gemini] = await Promise.all([
    photoService.checkHealth(),
    aiService.checkHealth()
  ]);
  
  res.json({
    unsplash,
    gemini,
    env: (keys.UNSPLASH && keys.GEMINI) ? 'OK' : 'MISSING',
    db: mongoose.connection.readyState === 1 ? 'OK' : 'OFFLINE'
  });
});

// ──── Routes ────
app.use('/', authRoutes);
app.use('/ai', aiRoutes);
app.use('/travel', travelRoutes);
app.use('/places', placesRoutes);

// ──── Start server ────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  if (mongoose.connection.readyState !== 1) {
    console.log('⚠️ Running in OFFLINE mode (No MongoDB)');
  }
});

// Background DB connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.log('ℹ️ MongoDB not connected (Background)'));
}

module.exports = app;

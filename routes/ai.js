const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { generateItinerary, getHiddenGems } = require('../services/aiService');
const Trip = require('../models/Trip');
const Itinerary = require('../models/Itinerary');
const { mockTrips } = require('../services/stateService');

// Middleware to ensure user is logged in
const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};

// Render AI Assistant page
router.get('/chat', ensureAuth, (req, res) => {
  res.render('ai-chat', { user: req.user });
});

// POST /ai/itinerary - Generate and SAVE itinerary
router.post('/itinerary', ensureAuth, async (req, res) => {
  const { tripId, destination, days, interests, budget, travelers } = req.body;
  try {
    const aiResult = await generateItinerary({ destination, days, interests, budget, travelers });
    
    if (mongoose.connection.readyState === 1) {
      if (tripId && aiResult.days) {
        const savedItineraries = [];
        for (const dayData of aiResult.days) {
          const item = new Itinerary({
            tripId,
            day: dayData.day,
            activities: dayData.activities,
            notes: dayData.notes,
            aiGenerated: true
          });
          await item.save();
          savedItineraries.push(item._id);
        }
        await Trip.findByIdAndUpdate(tripId, { $push: { itinerary: { $each: savedItineraries } } });
      }
    } else {
      // OFFLINE MODE: Save to shared state mockTrips
      const trip = mockTrips.find(t => t._id === tripId);
      if (trip && aiResult.days) {
        // Map the AI result to the format expected by the view
        trip.itinerary = aiResult.days.map(d => ({
          day: d.day,
          activities: d.activities,
          notes: d.notes,
          aiGenerated: true
        }));
        console.log(`✅ Itinerary saved to Mock Trip: ${tripId}`);
      }
    }
    
    res.json({ success: true, itinerary: aiResult });
  } catch (err) {
    console.error('AI Route Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tips', ensureAuth, async (req, res) => {
  const { city, style } = req.body;
  try {
    const tips = await getHiddenGems(city, style);
    res.json({ success: true, tips });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

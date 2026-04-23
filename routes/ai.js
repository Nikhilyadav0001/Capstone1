const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { generateItinerary, getHiddenGems } = require('../services/aiService');
const mlService = require('../services/mlService');
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
    // Use `let` so we can update aiResult in offline mode
    let aiResult = await generateItinerary({ destination, days, interests, budget, travelers });
    console.log(`📦 aiResult source: ${aiResult && aiResult.source}`);

    if (mongoose.connection.readyState === 1) {
      // ── ONLINE MODE: Save each day's itinerary to MongoDB ──
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
        console.log(`✅ Saved ${savedItineraries.length} ML itinerary days to MongoDB for trip: ${tripId}`);
      }
    } else {
      // ── OFFLINE MODE: Generate itinerary using local ML service ──
      try {
        const mlItin = await Promise.resolve(
          mlService.generateItinerary({ destination, days, interests, budget, travelers })
        );
        console.log(`🤖 ML Offline itinerary source: ${mlItin && mlItin.source}, days: ${mlItin && mlItin.days && mlItin.days.length}`);

        // Update the in-memory mock trip so page reload shows ML output
        const trip = mockTrips.find(t => t._id === tripId);
        if (trip) {
          trip.itinerary = Array.isArray(mlItin.days) ? mlItin.days.map(d => ({
            day: d.day,
            activities: Array.isArray(d.activities) ? d.activities : [],
            notes: d.notes || '',
            aiGenerated: true
          })) : [];
          trip.itinerarySource = mlItin.source || 'itinerary_model';
          console.log(`✅ Mock trip itinerary replaced with ML result for: ${tripId}`);
        }

        // Update aiResult with ML data so the JSON response also reflects it
        aiResult = {
          tripTitle: mlItin.tripTitle || `${days}-Day ${destination} Itinerary`,
          days: mlItin.days || [],
          generalTips: mlItin.generalTips || [],
          source: mlItin.source || 'itinerary_model'
        };
      } catch (e) {
        console.warn('⚠️  mlService.generateItinerary failed in offline mode:', e && e.message ? e.message : e);
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

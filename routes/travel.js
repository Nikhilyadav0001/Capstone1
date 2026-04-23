const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const { getPhoto } = require('../services/photoService');
const { getWeather } = require('../services/weatherService');
const { mockTrips } = require('../services/stateService');
const { analyzeTripCost } = require('../services/aiService');

// Middleware to ensure user is logged in
const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};

// Render 'New Trip' page
router.get('/new', ensureAuth, (req, res) => {
  res.render('trip-new', { user: req.user });
});

// Create a new trip
router.post('/', ensureAuth, async (req, res) => {
  try {
    const { destination, startDate, endDate, travelers, costFlights, costAccommodation, costFood, costActivities, costTransportation, costOther, costAnalysis } = req.body;
    
    if (mongoose.connection.readyState === 1) {
      const trip = new Trip({
        userId: req.user._id,
        destination,
        dates: { start: new Date(startDate), end: new Date(endDate) },
        travelers,
        costBreakdown: {
          flights: parseFloat(costFlights) || 0,
          accommodation: parseFloat(costAccommodation) || 0,
          food: parseFloat(costFood) || 0,
          activities: parseFloat(costActivities) || 0,
          transportation: parseFloat(costTransportation) || 0,
          other: parseFloat(costOther) || 0
        },
        costAnalysis: costAnalysis || null
      });
      await trip.save();
      res.redirect(`/travel/${trip._id}`);
    } else {
      // OFFLINE MODE - Persist to shared state
      const mockTrip = {
        _id: Math.random().toString(36).substr(2, 9),
        userId: req.user._id,
        destination,
        dates: { start: new Date(startDate), end: new Date(endDate) },
        travelers,
        costBreakdown: {
          flights: parseFloat(costFlights) || 0,
          accommodation: parseFloat(costAccommodation) || 0,
          food: parseFloat(costFood) || 0,
          activities: parseFloat(costActivities) || 0,
          transportation: parseFloat(costTransportation) || 0,
          other: parseFloat(costOther) || 0
        },
        costAnalysis: costAnalysis || null,
        itinerary: [] // Start with empty itinerary
      };
      mockTrips.push(mockTrip);
      res.redirect(`/travel/${mockTrip._id}`);
    }
  } catch (err) {
    res.status(400).render('trip-new', { error: err.message, user: req.user });
  }
});

// Get a single trip
router.get('/:id', ensureAuth, async (req, res) => {
  try {
    let trip;
    if (mongoose.connection.readyState === 1) {
      trip = await Trip.findOne({ _id: req.params.id, userId: req.user._id }).populate('itinerary');
    } else {
      trip = mockTrips.find(t => t._id === req.params.id);
    }

    if (!trip) return res.status(404).send('Trip not found');
    
    const photoUrl = await getPhoto(trip.destination);
    const weather = await getWeather(trip.destination);
    
    res.render('trip-detail', { trip, photoUrl, weather, user: req.user });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// API: Get all trips
router.get('/api/list', ensureAuth, async (req, res) => {
  try {
    let trips;
    if (mongoose.connection.readyState === 1) {
      trips = await Trip.find({ userId: req.user._id }).sort({ createdAt: -1 });
    } else {
      trips = mockTrips.filter(t => t.userId === req.user._id);
    }
    res.json({ success: true, trips });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Analyze trip cost with AI
router.post('/analyze-cost', ensureAuth, async (req, res) => {
  try {
    const { flights, accommodation, food, activities, transportation, other, destination, travelers } = req.body;
    
    const costData = {
      flights: parseFloat(flights) || 0,
      accommodation: parseFloat(accommodation) || 0,
      food: parseFloat(food) || 0,
      activities: parseFloat(activities) || 0,
      transportation: parseFloat(transportation) || 0,
      other: parseFloat(other) || 0,
      destination,
      travelers: parseInt(travelers) || 1
    };
    
    const totalCost = costData.flights + costData.accommodation + costData.food + costData.activities + costData.transportation + costData.other;
    
    if (totalCost === 0) {
      return res.status(400).json({ success: false, error: 'Please enter at least one cost amount' });
    }
    
    const analysis = await analyzeTripCost(costData);
    
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('Cost analysis error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

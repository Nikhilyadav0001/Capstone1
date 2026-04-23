const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destination: { type: String, required: true },
  dates: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  budget: { type: Number },
  travelers: { type: Number, default: 1 },
  costBreakdown: {
    flights: { type: Number, default: 0 },
    accommodation: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    activities: { type: Number, default: 0 },
    transportation: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  costAnalysis: { type: String },
  itinerary: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Itinerary' }]
}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);

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
  itinerary: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Itinerary' }]
}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);

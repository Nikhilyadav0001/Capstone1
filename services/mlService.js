/**
 * ML SERVICE
 * ───────────
 * Loads trained models and exposes:
 *   - predictCost(params)       → predicted INR trip cost
 *   - generateItinerary(params) → day-by-day itinerary from real places data
 *
 * Both functions NEVER throw — always return valid data.
 */

const fs   = require('fs');
const path = require('path');
const { RandomForestRegression } = require('ml-random-forest');

// ─── Model Paths ──────────────────────────────────────────────────────────────
const COST_MODEL_PATH      = path.join(__dirname, '../models/cost_model.json');
const ITINERARY_MODEL_PATH = path.join(__dirname, '../models/itinerary_model.json');

// ─── Loaded Models ────────────────────────────────────────────────────────────
let costModel      = null;
let costModelMeta  = null;
let itinModel      = null;

// ─── Load Models (call once at app startup) ───────────────────────────────────
function loadModels() {
  // Cost model
  if (fs.existsSync(COST_MODEL_PATH)) {
    try {
      const raw      = JSON.parse(fs.readFileSync(COST_MODEL_PATH, 'utf-8'));
      costModelMeta  = raw;
      try { costModel = RandomForestRegression.load(raw.model); } catch(e) { costModel = null; }
      console.log(`✅ Cost model loaded (trained: ${raw.trainedAt})`);
    } catch (e) {
      console.warn('⚠️  Cost model load failed:', e.message);
    }
  } else {
    console.warn('⚠️  Cost model not found. Run: node scripts/trainCostModel.js');
  }

  // Itinerary model
  if (fs.existsSync(ITINERARY_MODEL_PATH)) {
    try {
      itinModel = JSON.parse(fs.readFileSync(ITINERARY_MODEL_PATH, 'utf-8'));
      console.log(`✅ Itinerary model loaded (${itinModel.cityCount} cities, ${itinModel.placeCount} places)`);
    } catch (e) {
      console.warn('⚠️  Itinerary model load failed:', e.message);
    }
  } else {
    console.warn('⚠️  Itinerary model not found. Run: node scripts/trainItineraryModel.js');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeCity(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/bengaluru/g, 'bangalore')
    .replace(/bombay/g,    'mumbai')
    .replace(/calcutta/g,  'kolkata')
    .replace(/madras/g,    'chennai')
    .replace(/new delhi/g, 'delhi');
}

const CITY_TIERS = {
  mumbai: 1, delhi: 1, bangalore: 1, chennai: 1, kolkata: 1, hyderabad: 1,
  pune: 2, ahmedabad: 2, jaipur: 2, lucknow: 2, kochi: 2, goa: 2,
  chandigarh: 2, indore: 2, surat: 2,
};

function getCityTier(city) {
  return CITY_TIERS[normalizeCity(city)] || 2;
}

const BUDGET_ENCODING = { economy: 1, moderate: 2, luxury: 3 };

// Fallback hotel price estimates per tier per budget (INR/night)
const FALLBACK_HOTEL_PRICE = {
  1: { economy: 1500, moderate: 4000, luxury: 12000 },
  2: { economy: 1000, moderate: 2500, luxury:  8000 },
  3: { economy:  800, moderate: 2000, luxury:  6000 },
};

// ─── COST PREDICTION ──────────────────────────────────────────────────────────
/**
 * predictCost({ destination, days, travelers, budgetType })
 * Returns { total, perPerson, breakdown, source }
 */
function predictCost({ destination, days = 3, travelers = 2, budgetType = 'moderate' }) {
  const city     = normalizeCity(destination);
  const tier     = getCityTier(city);
  const budgetEnc = BUDGET_ENCODING[budgetType] || 2;
  const hotelEst = FALLBACK_HOTEL_PRICE[tier][budgetType] || FALLBACK_HOTEL_PRICE[tier]['moderate'];

  let total = 0;
  let source = 'formula';

  if (costModel) {
    try {
      const features = [tier, budgetEnc, days, travelers, hotelEst];
      total  = Math.round(costModel.predict([features])[0]);
      source = 'ml_model';
    } catch (e) {
      console.warn('⚠️  ML cost prediction failed, using formula');
    }
  }

  // Formula fallback if model not available or failed
  if (total <= 0) {
    const hotelTotal       = hotelEst * days * travelers;
    const foodPerDay       = tier === 1
      ? (budgetEnc === 1 ? 400 : budgetEnc === 2 ? 800  : 2000)
      : (budgetEnc === 1 ? 300 : budgetEnc === 2 ? 600  : 1500);
    const activitiesPerDay = tier === 1
      ? (budgetEnc === 1 ? 200 : budgetEnc === 2 ? 500  : 1500)
      : (budgetEnc === 1 ? 150 : budgetEnc === 2 ? 400  : 1000);
    const localTransport   = (tier === 1 ? 300 : 200) * days * travelers;

    total  = hotelTotal + (foodPerDay * days * travelers) + (activitiesPerDay * days) + localTransport;
    source = 'formula';
  }

  // Build breakdown
  const hotelTotal = hotelEst * days * travelers;
  const remaining  = Math.max(0, total - hotelTotal);

  const breakdown = {
    accommodation: Math.round(hotelTotal),
    food:          Math.round(remaining * 0.45),
    activities:    Math.round(remaining * 0.30),
    transport:     Math.round(remaining * 0.25),
    total:         Math.round(total),
  };

  return {
    total:     Math.round(total),
    perPerson: Math.round(total / Math.max(1, travelers)),
    breakdown,
    currency:  'INR',
    source,
    city,
    days,
    travelers,
    budgetType,
  };
}

// ─── ITINERARY GENERATION ─────────────────────────────────────────────────────
/**
 * generateItinerary({ destination, days, interests, budget, travelers })
 * Returns { tripTitle, days: [...], generalTips, source }
 */
function generateItinerary({ destination, days = 3, interests = 'culture', budget = 'moderate', travelers = 2 }) {
  const city       = normalizeCity(destination);
  const budgetType = budget || 'moderate';
  const interestList = String(interests || 'culture')
    .toLowerCase()
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean);

  // ── Try model ──
  if (itinModel && itinModel.cityModels) {
    const cityModel = itinModel.cityModels[city]
      || itinModel.cityModels[Object.keys(itinModel.cityModels).find(k => k.includes(city) || city.includes(k))];

    if (cityModel && cityModel.scoredPlaces.length > 0) {
      return buildItineraryFromModel(cityModel, destination, days, interestList, budgetType, travelers);
    }
  }

  // ── Fallback ──
  return buildGenericItinerary(destination, days, travelers);
}

function buildItineraryFromModel(cityModel, destination, days, interestList, budgetType, travelers) {
  // Score and sort places
  const scored = cityModel.scoredPlaces.map(place => {
    let totalScore = 0;
    for (const interest of interestList) {
      const key = `${interest}_${budgetType}`;
      totalScore += place.scores[key] || place.scores[`culture_${budgetType}`] || 0;
    }
    return { ...place, totalScore: totalScore / Math.max(1, interestList.length) };
  }).sort((a, b) => b.totalScore - a.totalScore);

  // Distribute places across days (aim for 3–4 places/day)
  const placesPerDay = 3;
  const totalNeeded  = days * placesPerDay;
  const selected     = scored.slice(0, Math.min(totalNeeded + 5, scored.length));

  const dayPlans = [];
  let placeIdx   = 0;

  for (let d = 1; d <= days; d++) {
    const activities = [];
    const dayPlaces  = selected.slice(placeIdx, placeIdx + placesPerDay);
    placeIdx        += placesPerDay;

    for (const place of dayPlaces) {
      let activity = `Visit ${place.name}`;
      if (place.type) activity += ` (${place.type})`;
      if (place.entranceFee > 0) activity += ` — Entry: ₹${place.entranceFee}`;
      if (place.bestTime) activity += ` | Best time: ${place.bestTime}`;
      activities.push(activity);
    }

    if (activities.length === 0) {
      activities.push(`Explore local markets and cuisine in ${destination}`);
      activities.push('Leisure time and shopping');
    }

    const notes = dayPlaces.length > 0
      ? `Start your day ${dayPlaces[0].bestTime === 'Morning' ? 'early' : 'after lunch'} for the best experience.`
      : `Enjoy a relaxed day exploring ${destination} at your own pace.`;

    dayPlans.push({ day: d, activities, notes });
  }

  // General tips based on real data
  const topRated = scored.slice(0, 3).map(p => p.name);
  const freePlaces = scored.filter(p => p.entranceFee === 0).slice(0, 2).map(p => p.name);

  const topRatedStr = topRated.join(', ');
  const freePlacesStr = freePlaces.length > 0 ? `Free entry places: ${freePlaces.join(', ')}` : 'Book tickets in advance for popular spots';
  const generalTips = [
    `Top rated spots: ${topRatedStr}`,
    freePlacesStr,
    `Best travel budget type selected: ${budgetType}`,
    `For ${travelers} traveler(s) — consider group discounts at monuments`,
    'Use local transport (auto/metro) to save on commute costs',
  ];

  return {
    tripTitle: `${days}-Day ${destination} Itinerary`,
    days: dayPlans,
    generalTips,
    source: 'itinerary_model',
    totalPlaces: cityModel.totalPlaces,
  };
}

function buildGenericItinerary(destination, days, travelers) {
  return {
    tripTitle: `${days}-Day Adventure in ${destination}`,
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      activities: [
        `Explore famous landmarks of ${destination}`,
        'Try local cuisine and street food',
        'Visit local markets and cultural spots',
      ],
      notes: 'Generated using offline fallback — train the model for richer itineraries.',
    })),
    generalTips: [
      'Book accommodation in advance',
      'Carry cash for local markets',
      'Use public transport where available',
    ],
    source: 'generic_fallback',
  };
}

// ─── Cost Analysis Text ───────────────────────────────────────────────────────
/**
 * analyzeCost(costData) → formatted string analysis in INR
 */
function analyzeCost({ destination, travelers = 1, budgetType = 'moderate', flights = 0, accommodation = 0, food = 0, activities = 0, transportation = 0, other = 0 }) {
  const total      = flights + accommodation + food + activities + transportation + other;
  const perPerson  = Math.round(total / Math.max(1, travelers));
  const city       = normalizeCity(destination);
  const tier       = getCityTier(city);

  // Get expected range from model
  const expected = predictCost({ destination, days: 5, travelers, budgetType });

  const adequacy = total >= expected.total * 0.8
    ? '✅ Your budget looks adequate for this trip.'
    : `⚠️ Your budget may be tight. Expected range: ₹${expected.total.toLocaleString('en-IN')} for a typical ${budgetType} trip.`;

  const tierLabel = tier === 1 ? 'Metro city' : tier === 2 ? 'Tier-2 city' : 'Tourist destination';

  return `💰 Cost Analysis for ${destination} (${tierLabel})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Budget:    ₹${total.toLocaleString('en-IN')}
Per Person:      ₹${perPerson.toLocaleString('en-IN')}
Travel Style:    ${budgetType.charAt(0).toUpperCase() + budgetType.slice(1)}
Travelers:       ${travelers}

📊 Budget Breakdown:
  ✈️  Flights:         ₹${flights.toLocaleString('en-IN')} (${total > 0 ? Math.round(flights/total*100) : 0}%)
  🏨  Accommodation:   ₹${accommodation.toLocaleString('en-IN')} (${total > 0 ? Math.round(accommodation/total*100) : 0}%)
  🍽️  Food & Dining:   ₹${food.toLocaleString('en-IN')} (${total > 0 ? Math.round(food/total*100) : 0}%)
  🎭  Activities:      ₹${activities.toLocaleString('en-IN')} (${total > 0 ? Math.round(activities/total*100) : 0}%)
  🚗  Transport:       ₹${transportation.toLocaleString('en-IN')} (${total > 0 ? Math.round(transportation/total*100) : 0}%)
  📦  Other:           ₹${other.toLocaleString('en-IN')} (${total > 0 ? Math.round(other/total*100) : 0}%)

${adequacy}

💡 Smart Tips for ${destination}:
  • ${tier === 1 ? 'Use metro/local trains to save ₹200-500/day on transport' : 'Auto-rickshaws are cheapest for short distances'}
  • ${budgetType === 'economy' ? 'Look for guesthouses and hostels — save up to 60% vs hotels' : budgetType === 'luxury' ? 'Book hotel+flight combos for 15-20% savings' : 'Mid-range hotels near city centre save on transport costs'}
  • Book flights 3–4 weeks in advance for best INR fares
  • Visit free monuments (many government sites are free or under ₹100)
  • Eat at local dhabas/restaurants — quality food at ₹100-300/meal

📈 ML-Based Budget Estimate (${budgetType}, ${travelers} pax):
  Expected total: ₹${expected.total.toLocaleString('en-IN')}
  Per person:     ₹${expected.perPerson.toLocaleString('en-IN')}
  Source: ${expected.source === 'ml_model' ? '🤖 Trained ML Model' : '📐 Formula estimate'}`;
}

module.exports = {
  loadModels,
  predictCost,
  generateItinerary,
  analyzeCost,
};
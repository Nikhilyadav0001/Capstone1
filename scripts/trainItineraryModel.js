/**
 * TRAIN ITINERARY MODEL
 * Run: node scripts/trainItineraryModel.js
 * Output: models/itinerary_model.json
 */

console.log('🚀 Starting Itinerary Model Training...');

const fs = require('fs');
const path = require('path');

// ── Read CSV synchronously ────────────────────────────────────────────────────
function readCSVSync(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const lines = fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = [];
    let current = '';
    let inQuotes = false;

    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());

    if (cols.length >= 3) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = (cols[idx] || '').replace(/"/g, '').trim();
      });
      rows.push(row);
    }
  }
  return rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeCity(name) {
  return String(name || '').toLowerCase().trim()
    .replace('bengaluru', 'bangalore')
    .replace('new delhi', 'delhi');
}

function parseNum(str) {
  const n = parseFloat(String(str || '0').replace(/[",\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parsePrice(str) {
  if (!str) return 0;
  const n = parseFloat(String(str).replace(/[",\s₹]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ── Interest → significance mapping ──────────────────────────────────────────
const INTEREST_MAP = {
  culture: ['Historical', 'Architectural', 'Artistic', 'Museum'],
  religious: ['Religious'],
  nature: ['Nature', 'Botanical', 'Wildlife', 'Environmental', 'Scenic'],
  adventure: ['Adventure', 'Wildlife'],
  food: ['Market', 'Recreational'],
  shopping: ['Market'],
  entertainment: ['Recreational', 'Entertainment'],
  romantic: ['Scenic', 'Nature', 'Botanical'],
  family: ['Recreational', 'Entertainment', 'Wildlife', 'Scientific'],
  science: ['Scientific'],
};

const BUDGET_FEE = {
  economy: 100,
  moderate: 500,
  luxury: Infinity
};

// ── Scoring Function ─────────────────────────────────────────────────────────
function scorePlace(place, interest, budget) {
  let score = 0;

  // Rating weight
  score += (parseNum(place['Google review rating']) / 5) * 40;

  // Popularity weight
  score += Math.min(
    Math.log1p(parseNum(place['Number of google review in lakhs'])) / Math.log1p(10),
    1
  ) * 20;

  // Interest matching
  const matchTypes = INTEREST_MAP[interest] || [];
  const sig = (place['Significance'] || '').toLowerCase();
  const type = (place['Type'] || '').toLowerCase();

  if (matchTypes.some(t =>
    sig.includes(t.toLowerCase()) || type.includes(t.toLowerCase())
  )) {
    score += 30;
  }

  // Budget constraint
  const fee = parsePrice(place['Entrance Fee in INR'] || '0');
  const feeLimit = BUDGET_FEE[budget] || 500;

  score += fee <= feeLimit ? 10 : -10;

  return Math.max(0, Math.round(score));
}

// ── Load CSV ─────────────────────────────────────────────────────────────────
console.log('📂 Reading places CSV...');

const placesFile = path.join(__dirname, '../data/places/Top Indian Places to Visit.csv');
const rows = readCSVSync(placesFile);

console.log(`   ${rows.length} places loaded`);

// ── Group by city ────────────────────────────────────────────────────────────
const placesData = {};

for (const row of rows) {
  const city = normalizeCity(row['City'] || '');
  if (!city) continue;

  if (!placesData[city]) {
    placesData[city] = [];
  }
  placesData[city].push(row);
}

console.log(`   ${Object.keys(placesData).length} cities found`);

// ── Pre-score places ─────────────────────────────────────────────────────────
console.log('🔨 Scoring places...');

const interests = Object.keys(INTEREST_MAP);
const budgets = ['economy', 'moderate', 'luxury'];

const cityModels = {};

for (const [city, places] of Object.entries(placesData)) {
  cityModels[city] = {
    totalPlaces: places.length,
    scoredPlaces: places.map(place => {
      const scores = {};

      for (const interest of interests) {
        for (const budget of budgets) {
          scores[`${interest}_${budget}`] = scorePlace(place, interest, budget);
        }
      }

      return {
        name: place['Name'] || '',
        type: place['Type'] || '',
        significance: place['Significance'] || '',
        rating: parseNum(place['Google review rating']),
        entranceFee: parsePrice(place['Entrance Fee in INR'] || '0'),
        bestTime: place['Best Time to visit'] || 'Morning',
        timeNeeded: parseNum(place['time needed to visit in hrs'] || '1'),
        weeklyOff: place['Weekly Off'] || 'None',
        scores,
      };
    }),
  };
}

// ── Save model ───────────────────────────────────────────────────────────────
const modelsDir = path.join(__dirname, '../models');

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const modelPath = path.join(modelsDir, 'itinerary_model.json');

const cityCount = Object.keys(cityModels).length;
const placeCount = Object.values(cityModels).reduce(
  (sum, c) => sum + c.totalPlaces,
  0
);

const payload = JSON.stringify({
  version: '1.0',
  trainedAt: new Date().toISOString(),
  cityCount,
  placeCount,
  interestMap: INTEREST_MAP,
  cityModels,
}, null, 2);

fs.writeFileSync(modelPath, payload);

console.log(
  `\n💾 Saved → models/itinerary_model.json (${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB)`
);
console.log(`   Cities: ${cityCount}`);
console.log(`   Places: ${placeCount}`);
console.log('✅ Itinerary model training complete!');
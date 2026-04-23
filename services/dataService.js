const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// ─── In-Memory Stores ────────────────────────────────────────────────────────
let hotelData = {};   // { "mumbai": [{ name, price, tax, rating, starRating, location }] }
let flightData = [];   // [{ from, to, airline, price, duration }]
let placesData = {};   // { "mumbai": [{ name, type, rating, entranceFee, bestTime, ... }] }
let isLoaded = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePrice(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/[",\s₹]/g, ''));
    return isNaN(n) ? 0 : n;
}

function parseNum(str) {
    const n = parseFloat(String(str || '0').replace(/[",\s]/g, ''));
    return isNaN(n) ? 0 : n;
}

function normalizeCity(name) {
    return String(name || '')
        .toLowerCase()
        .trim()
        .replace(/bengaluru/g, 'bangalore')
        .replace(/bombay/g, 'mumbai')
        .replace(/calcutta/g, 'kolkata')
        .replace(/madras/g, 'chennai')
        .replace(/new delhi/g, 'delhi');
}

function loadCSV(filePath) {
    return new Promise((resolve) => {
        const results = [];
        if (!fs.existsSync(filePath)) {
                console.warn(`⚠️  Not found: ${filePath}`);
            return resolve([]);
        }
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => results.push(row))
            .on('end', () => resolve(results))
            .on('error', (err) => {
                    console.warn(`⚠️  CSV error ${filePath}: ${err.message}`);
                resolve([]);
            });
    });
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

async function loadHotels() {
    const hotelDir = path.join(__dirname, '../data/hotel');
    if (!fs.existsSync(hotelDir)) return;
    const files = fs.readdirSync(hotelDir).filter(f => f.endsWith('.csv'));

    for (const file of files) {
        const cityName = normalizeCity(path.basename(file, '.csv'));
        const rows = await loadCSV(path.join(hotelDir, file));

        hotelData[cityName] = rows
            .map(r => ({
                name: r['Hotel Name'] || '',
                price: parsePrice(r['Price']),
                tax: parsePrice(r['Tax']),
                rating: parseNum(r['Rating']),
                starRating: parseNum(r['Star Rating']),
                location: r['Location'] || '',
                ratingDesc: r['Rating Description'] || '',
                reviews: parseNum(r['Reviews']),
            }))
            .filter(h => h.price > 0);

        console.log(`✅ Hotels [${cityName}]: ${hotelData[cityName].length} records`);
    }
}

async function loadFlights() {
    const flightDir = path.join(__dirname, '../data/flight');
    if (!fs.existsSync(flightDir)) return;
    const files = fs.readdirSync(flightDir).filter(f => f.endsWith('.csv'));

    for (const file of files) {
        const rows = await loadCSV(path.join(flightDir, file));
        for (const r of rows) {
            const price = parsePrice(r['Price']);
            if (price > 0) {
                flightData.push({
                    from: normalizeCity(r['DepartingCity'] || ''),
                    to: normalizeCity(r['ArrivingCity'] || ''),
                    airline: r['FlightName'] || '',
                    code: r['FlightCode'] || '',
                    price,
                    duration: r['Duration'] || '',
                });
            }
        }
    }
    console.log(`✅ Flights: ${flightData.length} records`);
}

async function loadPlaces() {
    const placesFile = path.join(__dirname, '../data/places/Top Indian Places to Visit.csv');
    const rows = await loadCSV(placesFile);

    for (const r of rows) {
        const city = normalizeCity(r['City'] || '');
        if (!city) continue;
        if (!placesData[city]) placesData[city] = [];

        placesData[city].push({
            name: r['Name'] || '',
            type: r['Type'] || '',
            significance: r['Significance'] || '',
            rating: parseNum(r['Google review rating']),
            entranceFee: parsePrice(r['Entrance Fee in INR'] || '0'),
            bestTime: r['Best Time to visit'] || 'Morning',
            timeNeeded: parseNum(r['time needed to visit in hrs'] || '1'),
            dslrAllowed: (r['DSLR Allowed'] || '').toLowerCase() === 'yes',
            weeklyOff: r['Weekly Off'] || 'None',
            reviews: parseNum(r['Number of google review in lakhs'] || '0'),
            zone: r['Zone'] || '',
            state: r['State'] || '',
        });
    }
    console.log(`✅ Places: ${Object.keys(placesData).length} cities loaded`);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function loadAllData() {
    if (isLoaded) return;
    console.log('📂 Loading CSV datasets into memory...');
    await Promise.all([loadHotels(), loadFlights(), loadPlaces()]);
    isLoaded = true;
    console.log('🎉 All datasets ready');
}

// ─── Query API ────────────────────────────────────────────────────────────────

function getHotelsByCity(city) {
    return hotelData[normalizeCity(city)] || [];
}

function getFlightsBetween(from, to) {
    const f = normalizeCity(from);
    const t = normalizeCity(to);
    return flightData.filter(fl =>
        (fl.from === f && fl.to === t) ||
        (fl.from === t && fl.to === f)
    );
}

function getPlacesByCity(city) {
    const key = normalizeCity(city);
    if (placesData[key]) return placesData[key];
    // partial match for edge cases like "New Delhi" -> "delhi"
    const partial = Object.keys(placesData).find(k => k.includes(key) || key.includes(k));
    return partial ? placesData[partial] : [];
}

function getHotelPriceStats(city) {
    const hotels = getHotelsByCity(city);
    if (hotels.length === 0) return null;
    const prices = hotels.map(h => h.price).sort((a, b) => a - b);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return {
        min: prices[0],
        max: prices[prices.length - 1],
        avg: Math.round(avg),
        median: prices[Math.floor(prices.length / 2)],
        count: prices.length,
    };
}

function getFlightPriceStats(from, to) {
    const flights = getFlightsBetween(from, to);
    if (flights.length === 0) return null;
    const prices = flights.map(f => f.price).sort((a, b) => a - b);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return {
        min: prices[0],
        max: prices[prices.length - 1],
        avg: Math.round(avg),
        median: prices[Math.floor(prices.length / 2)],
        count: prices.length,
    };
}

function getAllCities() {
    return [...new Set([
        ...Object.keys(hotelData),
        ...Object.keys(placesData),
    ])].sort();
}

module.exports = {
    loadAllData,
    getHotelsByCity,
    getFlightsBetween,
    getPlacesByCity,
    getHotelPriceStats,
    getFlightPriceStats,
    getAllCities,
    // raw access for training scripts
    getRawHotelData: () => hotelData,
    getRawFlightData: () => flightData,
    getRawPlacesData: () => placesData,
};
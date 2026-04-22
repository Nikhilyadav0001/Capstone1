// Shared state for "Offline Mode" to persist data during the session
const mockTrips = [];
const mockUsers = [
  { _id: 'mock123', name: 'Demo User', email: 'demo@example.com', password: 'password' }
];

module.exports = {
  mockTrips,
  mockUsers
};

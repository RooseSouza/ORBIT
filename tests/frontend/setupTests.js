/**
 * Jest setup file for frontend tests.
 * Runs before each test suite.
 */

// Mock Firebase Auth
global.firebase = {
  auth: jest.fn(() => ({
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(callback => {
      callback(null); // No user by default
      return jest.fn(); // Unsubscribe function
    }),
  })),
};

// Mock Firestore
global.db = {
  collection: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    onSnapshot: jest.fn((callback) => {
      callback({ docs: [] });
      return jest.fn(); // Unsubscribe function
    }),
    get: jest.fn().mockResolvedValue({ docs: [] }),
  })),
};

// Mock window.fetch
global.fetch = jest.fn();

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock Notification API
global.Notification = {
  permission: 'default',
  requestPermission: jest.fn().mockResolvedValue('granted'),
};

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

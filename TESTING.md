# Testing Documentation

This project includes comprehensive unit tests for both backend (Python/Flask) and frontend (JavaScript) code.

## Project Overview

- **Backend**: Flask application with Firebase integration, API endpoints, image handling, and email reminders
- **Frontend**: Vanilla JavaScript with authentication flows, event display, image carousel, and admin panel
- **Database**: Firestore
- **Auth Methods**: Google OAuth 2.0, Email/Password, Guest Mode

## Test Structure

```
tests/
├── backend/
│   ├── conftest.py                 # Pytest configuration and fixtures
│   ├── test_app.py                 # Route and app tests
│   ├── test_api.py                 # API endpoint tests
│   ├── test_image_handling.py       # Image processing tests
│   └── __init__.py
├── frontend/
│   ├── setupTests.js               # Jest configuration
│   ├── login-logic.test.js          # Login flow tests
│   ├── create-account-logic.test.js # Account creation tests
│   ├── admin-logic.test.js          # Admin/image handling tests
│   ├── app-logic.test.js            # App display/carousel tests
│   └── __init__.py
└── __init__.py
```

## Backend Testing (Python/pytest)

### Setup

1. Install test dependencies:
   ```bash
   pip install pytest pytest-cov pytest-mock
   ```

2. Or install from requirements.txt which now includes testing dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running Backend Tests

Run all backend tests:
```bash
pytest tests/backend/
```

Run specific test file:
```bash
pytest tests/backend/test_app.py
```

Run with verbose output:
```bash
pytest tests/backend/ -v
```

Run with coverage report:
```bash
pytest tests/backend/ --cov=app --cov-report=html
```

Run specific test class:
```bash
pytest tests/backend/test_app.py::TestRoutes
```

Run specific test:
```bash
pytest tests/backend/test_app.py::TestRoutes::test_login_route
```

### Backend Test Coverage

**test_app.py** - Flask routes and app functionality:
- ✅ Route rendering (login, home, bookmarks, admin, create-account)
- ✅ 404 handling
- ✅ Ping endpoint with token validation
- ✅ Email reminder sending
- ✅ Time formatting (days/hours representation)

**test_api.py** - REST API endpoints:
- ✅ API key authentication (header and query parameter)
- ✅ Event creation (minimal, full, with images/tickets)
- ✅ Date validation (ISO 8601 formats)
- ✅ Image handling in API
- ✅ Image limit enforcement (max 8)
- ✅ Ticket URL validation
- ✅ Event retrieval and sorting
- ✅ Error handling (422, 503)

**test_image_handling.py** - Image processing functions:
- ✅ URL normalization (HTTP/HTTPS validation)
- ✅ Image link parsing (comma/newline separated)
- ✅ Duplicate removal
- ✅ File upload processing (mime type validation)
- ✅ Data URL generation from uploaded files
- ✅ Whitespace handling
- ✅ Empty/invalid input handling

## Frontend Testing (JavaScript/Jest)

### Setup

1. Install Jest and dependencies:
   ```bash
   npm install --save-dev jest jest-environment-jsdom
   ```

2. Ensure `jest.config.js` and `tests/frontend/setupTests.js` exist (included in this package).

### Running Frontend Tests

Run all frontend tests:
```bash
npm test
```

Or using jest directly:
```bash
npx jest tests/frontend/
```

Watch mode (reruns on file changes):
```bash
npm test -- --watch
```

Coverage report:
```bash
npm test -- --coverage
```

Run specific test file:
```bash
npx jest tests/frontend/login-logic.test.js
```

Run specific test suite:
```bash
npx jest tests/frontend/admin-logic.test.js -t "URL Normalization"
```

### Frontend Test Coverage

**login-logic.test.js** - Email/password login:
- ✅ Email format validation
- ✅ Password minimum length (6 chars)
- ✅ Form validation (required fields)
- ✅ Enter key submission
- ✅ Button state management (disabled/enabled, loading)
- ✅ Error handling (operation-not-allowed, user-not-found, wrong-password)
- ✅ Session management (clearing guest/Google flags)

**create-account-logic.test.js** - Account creation:
- ✅ Email validation
- ✅ Password requirements
- ✅ Password confirmation matching
- ✅ Form validation (all fields required)
- ✅ Button/progress UI states
- ✅ Error handling (email-already-in-use, weak-password, operation-not-allowed)
- ✅ Success flow (redirect, session storage)
- ✅ Form reset

**admin-logic.test.js** - Admin panel/image handling:
- ✅ URL normalization (HTTP/HTTPS only)
- ✅ Image link parsing (comma/newline separated)
- ✅ Duplicate URL removal
- ✅ Image count limits (max 8)
- ✅ File upload processing (MIME type validation)
- ✅ Preview rendering
- ✅ Image validation (extensions, URLs with params)
- ✅ Ticket URL handling (validation, optional)
- ✅ Event data structure

**app-logic.test.js** - Homepage/event display:
- ✅ User type detection (Google, email, guest)
- ✅ Data fetch routing (Google vs Firestore-only)
- ✅ Warning suppression (no Google warnings for email users)
- ✅ Image carousel (prev/next, dots, counter)
- ✅ Carousel navigation (wrap-around)
- ✅ Safe URL decoding
- ✅ Event rendering (title, date, thumbnail)
- ✅ Ticket button display (validation, conditional rendering)
- ✅ XSS prevention (HTML escaping)
- ✅ Modal interactions (open/close, content population)

## Test Categories

### Unit Tests
Each test file contains isolated tests of individual functions and modules:
- Input validation
- Function output verification
- Error condition handling
- Edge cases (empty inputs, limits, invalid data)

### Mocking
Tests use Jest mocks for:
- Firebase Auth
- Firestore database
- HTTP requests
- localStorage
- Notification API

### No External Dependencies
Tests run without:
- Database connections
- Firebase initialization
- Email sending
- HTTP requests

## Coverage Goals

Current test structure provides coverage for:
- **Backend**: 50%+ lines, 50%+ functions
- **Frontend**: 50%+ lines, 50%+ functions

These baselines ensure critical path testing without over-coverage that slows development.

## Adding New Tests

### Backend Example
```python
def test_new_feature(self, client):
    """Test description."""
    response = client.get('/endpoint')
    assert response.status_code == 200
```

### Frontend Example
```javascript
test('should validate new feature', () => {
  const result = newFeature('input');
  expect(result).toBe('expected');
});
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

**GitHub Actions example:**
```yaml
- name: Run backend tests
  run: pytest tests/backend/ --cov=app

- name: Run frontend tests
  run: npm test -- --coverage
```

## Debugging Tests

### Backend
```bash
# Verbose output with print statements
pytest tests/backend/ -v -s

# Stop on first failure
pytest tests/backend/ -x

# Run last failed
pytest tests/backend/ --lf
```

### Frontend
```bash
# Verbose
npx jest --verbose

# No coverage (faster)
npx jest --no-coverage

# Debug in browser
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Common Issues

### Backend

**"ModuleNotFoundError: No module named 'app'"**
- Ensure you're running pytest from project root
- Check `conftest.py` sys.path configuration

**Firebase initialization errors**
- Tests mock Firebase, but conftest.py patches imports
- Verify patches are in place before importing app

### Frontend

**"ReferenceError: fetch is not defined"**
- Check `setupTests.js` includes fetch mock
- Ensure jsdom testEnvironment in jest.config.js

**"Cannot find module"**
- Verify file paths in test imports
- Check moduleNameMapper in jest.config.js

## Performance

- **Backend tests**: ~2-5 seconds per file
- **Frontend tests**: ~1-3 seconds per file
- All tests should complete in <30 seconds total

## Next Steps

1. Run `pytest tests/backend/` to verify backend tests pass
2. Run `npm test` to verify frontend tests pass
3. Add tests for new features before implementation (TDD)
4. Aim to reach 70%+ coverage over time
5. Consider integration tests for critical user flows

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [Jest documentation](https://jestjs.io/)
- [Firebase Testing Strategies](https://firebase.google.com/docs/database/security/test-rules)
- [JavaScript Mocking with Jest](https://jestjs.io/docs/manual-mocks)

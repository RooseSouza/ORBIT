# Quick Test Reference

## Get Started Quickly

### Backend Tests (Python)

```bash
# Install dependencies (first time only)
pip install -r requirements.txt

# Run all tests
pytest tests/backend/

# Run with coverage
pytest tests/backend/ --cov=app --cov-report=html

# Run specific test file
pytest tests/backend/test_api.py -v
```

### Frontend Tests (JavaScript)

```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Run in watch mode (auto-rerun on changes)
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

## Test Files Overview

### Backend (Python/pytest)

| File | Tests | Purpose |
|------|-------|---------|
| `test_app.py` | 13 | Flask routes, ping endpoint, email reminders |
| `test_api.py` | 28 | API authentication, event CRUD, error handling |
| `test_image_handling.py` | 21 | URL validation, file processing, image limits |
| **Total** | **62** | **Backend coverage** |

### Frontend (JavaScript/Jest)

| File | Tests | Purpose |
|------|-------|---------|
| `login-logic.test.js` | 16 | Email login, validation, error handling |
| `create-account-logic.test.js` | 18 | Signup, password matching, form validation |
| `admin-logic.test.js` | 26 | Image handling, URL parsing, file uploads |
| `app-logic.test.js` | 35 | Auth routing, carousel, event display, XSS prevention |
| **Total** | **95** | **Frontend coverage** |

## Overall Coverage: 157 Tests

## Common Commands

### Development

```bash
# Watch mode - reruns tests on file changes
pytest tests/backend/ --watch
npm test -- --watch

# Verbose output
pytest tests/backend/ -v -s
npx jest --verbose
```

### CI/CD

```bash
# Generate coverage reports
pytest tests/backend/ --cov=app --cov-report=html --cov-report=term
npm test -- --coverage

# Stop on first failure
pytest tests/backend/ -x
npx jest --bail
```

### Debugging

```bash
# Run only one test
pytest tests/backend/test_app.py::TestRoutes::test_login_route
npx jest tests/frontend/login-logic.test.js -t "Email Validation"

# Print to stdout
pytest tests/backend/ -s
npx jest --silent=false
```

## What's Being Tested

### ✅ Backend (Python/Flask)

- Route rendering (5 pages)
- API authentication (header + query param)
- Event CRUD operations
- Image URL validation & normalization
- File upload processing
- ISO 8601 date validation
- Email reminders
- Error handling (422, 503, 401)
- Firestore integration points

### ✅ Frontend (JavaScript)

- Email/password login validation
- Account creation flow
- Image carousel navigation
- Event display rendering
- XSS prevention
- Auth type detection (Google/email/guest)
- Ticket URL handling
- Admin panel image management
- Modal interactions
- localStorage management

## Test Quality Metrics

- **157 total tests** across both stacks
- **No external dependencies** - all tests run offline
- **Fast execution** - full suite runs in <30 seconds
- **50%+ coverage** - critical paths tested
- **Mock-based** - Firebase, HTTP, localStorage all mocked

## Troubleshooting

### Tests won't run

**Python:**
```bash
# Check pytest is installed
pip install pytest pytest-cov pytest-mock

# Run from project root
cd c:\Users\roose\Desktop\code\Tasks\Orbit
pytest tests/backend/
```

**JavaScript:**
```bash
# Check Jest is installed
npm install

# Ensure Node is accessible
node --version
npm --version
```

### Import errors

**Python:**
```bash
# Verify app.py imports work
python -c "import app; print('OK')"

# Check sys.path in conftest.py
```

**JavaScript:**
```bash
# Verify jest.config.js exists
cat jest.config.js

# Check setupTests.js is referenced
```

## Next Steps

1. **Run all tests:** `pytest tests/backend/` + `npm test`
2. **Check coverage:** `--cov` flag for pytest, `--coverage` for Jest
3. **Add CI/CD:** Copy test commands to GitHub Actions/GitLab CI
4. **Increase coverage:** Target 70-80% as you develop
5. **TDD:** Write tests before implementing features

## Resources

See [TESTING.md](TESTING.md) for comprehensive documentation.

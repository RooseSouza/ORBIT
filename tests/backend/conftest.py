"""
Pytest configuration and fixtures for backend tests.
"""

import pytest
import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add parent directory to path so we can import app
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


@pytest.fixture
def app():
    """Create app instance for testing."""
    # Set test environment variables BEFORE importing app
    os.environ['ORGANISER_API_KEY'] = 'test-api-key'
    os.environ['MAIL_USERNAME'] = 'test@example.com'
    os.environ['MAIL_PASSWORD'] = 'test-password'
    
    # Mock Firebase to avoid initialization
    with patch('firebase_admin.initialize_app'):
        with patch('firebase_admin.credentials.Certificate'):
            # Clear any cached app import
            if 'app' in sys.modules:
                del sys.modules['app']
            
            # Import app fresh after mocking Firebase and setting env vars
            import app as app_module
            app_module.app.config['TESTING'] = True
            
            # Ensure API key is set in the module
            app_module.ORGANISER_API_KEY = 'test-api-key'
            
            yield app_module.app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def mock_db():
    """Mock Firebase Firestore database."""
    mock = MagicMock()
    return mock


@pytest.fixture
def mock_mail(app):
    """Mock Flask-Mail."""
    with patch('app.mail') as mail_mock:
        yield mail_mock


@pytest.fixture
def sample_event_data():
    """Sample event data for API tests."""
    return {
        'title': 'Test Event',
        'date': '2026-06-15T18:00:00',
        'description': 'A test event',
        'location': 'Test Venue',
        'ticketUrl': 'https://tickets.example.com/event'
    }


@pytest.fixture
def sample_image_urls():
    """Sample image URLs."""
    return [
        'https://cdn.pixabay.com/photo/2016/11/23/15/48/audience-1853662_1280.jpg',
        'https://www.pingpongmoments.in/blog/wp-content/uploads/2022/09/corporate-events-3.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/c/c7/Messe_Luzern_Corporate_Event.jpg'
    ]

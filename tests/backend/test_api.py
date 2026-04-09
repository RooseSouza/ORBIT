"""Focused API endpoint tests."""

from unittest.mock import MagicMock, patch


class TestApiAuthentication:
    def test_create_event_requires_api_key(self, client):
        response = client.post('/api/events', json={'title': 'T', 'date': '2026-06-15T18:00:00'})
        assert response.status_code == 401

    def test_get_events_requires_api_key(self, client):
        response = client.get('/api/events')
        assert response.status_code == 401


class TestApiCreateEvent:
    def test_create_event_success_minimal(self, client):
        with patch('app._db') as mock_db:
            mock_doc = MagicMock()
            mock_doc.id = 'event-123'
            mock_db.collection().document.return_value = mock_doc

            response = client.post(
                '/api/events',
                json={'title': 'Test Event', 'date': '2026-06-15T18:00:00'},
                headers={'X-API-Key': 'test-api-key'},
            )

        assert response.status_code == 201
        payload = response.get_json()
        assert payload['success'] is True
        assert payload['id'] == 'event-123'
        saved_payload = mock_doc.set.call_args[0][0]
        assert saved_payload['endDate']

    def test_create_event_accepts_end_date(self, client):
        with patch('app._db') as mock_db:
            mock_doc = MagicMock()
            mock_doc.id = 'event-789'
            mock_db.collection().document.return_value = mock_doc

            response = client.post(
                '/api/events',
                json={
                    'title': 'Test Event',
                    'date': '2026-06-15T18:00:00',
                    'endDate': '2026-06-15T20:00:00',
                },
                headers={'X-API-Key': 'test-api-key'},
            )

        assert response.status_code == 201
        saved_payload = mock_doc.set.call_args[0][0]
        assert saved_payload['endDate'] == '2026-06-15T20:00:00'

    def test_create_event_rejects_end_date_before_start(self, client):
        response = client.post(
            '/api/events',
            json={
                'title': 'Test Event',
                'date': '2026-06-15T18:00:00',
                'endDate': '2026-06-15T17:00:00',
            },
            headers={'X-API-Key': 'test-api-key'},
        )
        assert response.status_code == 422

    def test_create_event_missing_title_or_date(self, client):
        response_no_title = client.post(
            '/api/events',
            json={'date': '2026-06-15T18:00:00'},
            headers={'X-API-Key': 'test-api-key'},
        )
        response_no_date = client.post(
            '/api/events',
            json={'title': 'Test Event'},
            headers={'X-API-Key': 'test-api-key'},
        )
        assert response_no_title.status_code == 422
        assert response_no_date.status_code == 422

    def test_create_event_invalid_date_rejected(self, client):
        response = client.post(
            '/api/events',
            json={'title': 'Test Event', 'date': 'not-a-date'},
            headers={'X-API-Key': 'test-api-key'},
        )
        assert response.status_code == 422

    def test_create_event_accepts_images_and_ticket_url(self, client):
        with patch('app._db') as mock_db:
            mock_doc = MagicMock()
            mock_doc.id = 'event-456'
            mock_db.collection().document.return_value = mock_doc

            response = client.post(
                '/api/events',
                json={
                    'title': 'Test Event',
                    'date': '2026-06-15T18:00:00',
                    'ticketUrl': 'https://tickets.example.com/event',
                    'images': ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
                },
                headers={'X-API-Key': 'test-api-key'},
            )

        assert response.status_code == 201


class TestApiGetEvents:
    def test_get_events_success_and_sorted(self, client):
        with patch('app._db') as mock_db:
            mock_docs = [
                MagicMock(
                    id='event-2',
                    to_dict=MagicMock(return_value={'title': 'Later', 'date': '2026-07-15T18:00:00', 'endDate': '2026-07-15T19:00:00', 'description': '', 'locationValue': '', 'ticketUrl': '', 'images': []}),
                ),
                MagicMock(
                    id='event-1',
                    to_dict=MagicMock(return_value={'title': 'Sooner', 'date': '2026-06-15T18:00:00', 'endDate': '2026-06-15T19:00:00', 'description': '', 'locationValue': '', 'ticketUrl': '', 'images': []}),
                ),
            ]
            mock_db.collection().stream.return_value = mock_docs

            response = client.get('/api/events', headers={'X-API-Key': 'test-api-key'})

        assert response.status_code == 200
        payload = response.get_json()
        assert len(payload) == 2
        assert payload[0]['date'] <= payload[1]['date']
        assert payload[0]['endDate']

    def test_get_events_no_database_returns_503(self, client):
        with patch('app._db', None):
            response = client.get('/api/events', headers={'X-API-Key': 'test-api-key'})
        assert response.status_code == 503

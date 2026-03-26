"""Focused backend route and reminder tests."""


class TestRoutes:
    def test_core_pages_render(self, client):
        for path in ['/', '/create-account', '/home', '/bookmarks', '/admin']:
            response = client.get(path)
            assert response.status_code == 200

    def test_unknown_route_404(self, client):
        response = client.get('/does-not-exist')
        assert response.status_code == 404


class TestPingEndpoint:
    def test_ping_get_success(self, client):
        response = client.get('/ping')
        assert response.status_code == 200
        payload = response.get_json()
        assert payload['ok'] is True
        assert payload['service'] == 'orbit'
        assert 'time' in payload

    def test_ping_head_success(self, client):
        response = client.head('/ping')
        assert response.status_code == 204

    def test_ping_invalid_token_rejected(self, client, monkeypatch):
        monkeypatch.setenv('UPTIME_PING_TOKEN', 'secret')
        response = client.get('/ping?token=wrong')
        assert response.status_code == 401


class TestReminder:
    def test_send_reminder_success(self, client, mock_mail):
        response = client.post(
            '/send-reminder',
            json={'email': 'user@example.com', 'title': 'Test Event', 'days': 1, 'hours': 2},
        )
        assert response.status_code == 200
        assert response.get_json()['success'] is True
        mock_mail.send.assert_called_once()

    def test_send_reminder_mail_failure(self, client, mock_mail):
        mock_mail.send.side_effect = RuntimeError('smtp down')
        response = client.post(
            '/send-reminder',
            json={'email': 'user@example.com', 'title': 'Test Event', 'days': 1, 'hours': 2},
        )
        assert response.status_code == 500
        assert response.get_json()['success'] is False

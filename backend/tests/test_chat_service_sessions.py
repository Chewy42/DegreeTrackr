from app.services import chat_service


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_session_belongs_to_user_returns_true_for_owned_session(monkeypatch):
    def fake_supabase_request(method, path, **kwargs):
        assert method == "GET"
        assert "user_id=eq.user-123" in path
        assert "id=eq.session-456" in path
        return _FakeResponse(200, [{"id": "session-456"}])

    monkeypatch.setattr(chat_service, "supabase_request", fake_supabase_request)

    assert chat_service.session_belongs_to_user("user-123", "session-456") is True


def test_delete_chat_session_skips_delete_for_unowned_session(monkeypatch):
    calls = []

    def fake_supabase_request(method, path, **kwargs):
        calls.append((method, path))
        if method == "GET":
            return _FakeResponse(200, [])
        if method == "DELETE":
            raise AssertionError("DELETE should not be attempted for an unowned session")
        raise AssertionError(f"Unexpected method: {method}")

    monkeypatch.setattr(chat_service, "supabase_request", fake_supabase_request)

    chat_service.delete_chat_session("user-123", "session-456")

    assert calls == [
        ("GET", "/rest/v1/chat_sessions?id=eq.session-456&user_id=eq.user-123&select=id"),
    ]


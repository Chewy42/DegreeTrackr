from app.services import chat_service
from app.services import schedule_generator


def test_build_openai_client_returns_none_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    assert chat_service._build_openai_client() is None


def test_schedule_generator_client_returns_none_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    assert schedule_generator._build_openai_client() is None
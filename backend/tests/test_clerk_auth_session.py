import app.main as main

from app.main import app
from app.services.auth_tokens import decode_app_token
from app.services.clerk_auth import ClerkAuthError


def test_create_clerk_session_returns_app_token(monkeypatch):
    client = app.test_client()

    monkeypatch.setattr(main, 'get_authenticated_clerk_email', lambda _: 'student@chapman.edu')
    monkeypatch.setattr(main, 'ensure_app_user_record', lambda _: None)
    monkeypatch.setattr(
        main,
        'build_preferences',
        lambda _: {
            'theme': 'dark',
            'landingView': 'dashboard',
            'hasProgramEvaluation': False,
            'onboardingComplete': False,
        },
    )

    response = client.post(
        '/auth/clerk/session',
        headers={'Authorization': 'Bearer clerk-session-token'},
        json={'stayLoggedIn': True},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body['user']['email'] == 'student@chapman.edu'
    assert body['preferences']['landingView'] == 'dashboard'
    assert decode_app_token(body['token'])['email'] == 'student@chapman.edu'


def test_create_clerk_session_rejects_non_chapman_email(monkeypatch):
    client = app.test_client()

    monkeypatch.setattr(main, 'get_authenticated_clerk_email', lambda _: 'student@gmail.com')

    response = client.post(
        '/auth/clerk/session',
        headers={'Authorization': 'Bearer clerk-session-token'},
        json={},
    )

    assert response.status_code == 403
    assert '@chapman.edu' in response.get_json()['error']


def test_create_clerk_session_surfaces_auth_errors(monkeypatch):
    client = app.test_client()

    def raise_auth_error(_: str) -> str:
        raise ClerkAuthError('Invalid Clerk session token.')

    monkeypatch.setattr(main, 'get_authenticated_clerk_email', raise_auth_error)

    response = client.post('/auth/clerk/session', headers={'Authorization': 'Bearer bad-token'})

    assert response.status_code == 401
    assert response.get_json()['error'] == 'Invalid Clerk session token.'
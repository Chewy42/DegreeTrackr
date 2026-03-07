from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Dict, List

import jwt as pyjwt
import requests


class ClerkConfigurationError(RuntimeError):
    pass


class ClerkAuthError(RuntimeError):
    pass


CLERK_API_URL = os.getenv("CLERK_API_URL", "https://api.clerk.com").rstrip("/")


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ClerkConfigurationError(f"Missing Clerk configuration: {name}")
    return value


def _normalize_origin(url: str) -> str:
    normalized = url.strip().rstrip("/")
    if not normalized:
        return ""

    stripped = normalized.replace("http://", "").replace("https://", "")
    if "localhost" in stripped and ":" not in stripped:
        client_port = os.getenv("CLIENT_PORT", "5173").strip() or "5173"
        normalized = f"{normalized}:{client_port}"

    return normalized


def _authorized_parties() -> List[str]:
    configured = os.getenv("CLERK_AUTHORIZED_PARTIES", "")
    if configured.strip():
        return [
            party
            for party in (_normalize_origin(value) for value in configured.split(","))
            if party
        ]

    parties: List[str] = []
    for env_name in ("DEV_SERVER_URL", "PROD_SERVER_URL"):
        party = _normalize_origin(os.getenv(env_name, ""))
        if party and party not in parties:
            parties.append(party)
    return parties


@lru_cache(maxsize=1)
def _jwks_client() -> pyjwt.PyJWKClient:
    return pyjwt.PyJWKClient(_require_env("CLERK_JWKS_URL"))


def _extract_bearer_token(auth_header: str) -> str:
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        if token:
            return token
    raise ClerkAuthError("Missing Clerk bearer token.")


def verify_clerk_session_token(token: str) -> Dict[str, Any]:
    issuer = os.getenv("CLERK_ISSUER", "").strip() or None
    signing_key = _jwks_client().get_signing_key_from_jwt(token)

    try:
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options={
                "verify_aud": False,
                "verify_iss": bool(issuer),
            },
        )
    except pyjwt.PyJWTError as exc:
        raise ClerkAuthError("Invalid Clerk session token.") from exc

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise ClerkAuthError("Clerk session is missing a user identifier.")

    authorized_parties = _authorized_parties()
    if authorized_parties:
        azp = str(payload.get("azp", "")).rstrip("/")
        if not azp:
            raise ClerkAuthError("Clerk session is missing an authorized party.")
        if azp not in authorized_parties:
            raise ClerkAuthError("Invalid authorized party for Clerk session.")

    return payload


def get_clerk_user_email(user_id: str) -> str:
    secret_key = _require_env("CLERK_SECRET_KEY")
    response = requests.get(
        f"{CLERK_API_URL}/v1/users/{user_id}",
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Accept": "application/json",
        },
        timeout=10,
    )
    response.raise_for_status()

    try:
        data = response.json()
    except ValueError as exc:
        raise ClerkAuthError("Unable to parse Clerk user details.") from exc

    primary_email_id = data.get("primary_email_address_id")
    email_addresses = data.get("email_addresses") or []

    for email in email_addresses:
        if email.get("id") == primary_email_id and email.get("email_address"):
            return str(email["email_address"])

    for email in email_addresses:
        if email.get("email_address"):
            return str(email["email_address"])

    raise ClerkAuthError("Clerk user does not have an email address.")


def get_authenticated_clerk_email(auth_header: str) -> str:
    token = _extract_bearer_token(auth_header)
    payload = verify_clerk_session_token(token)
    return get_clerk_user_email(str(payload["sub"]))
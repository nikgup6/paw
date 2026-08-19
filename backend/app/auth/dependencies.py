"""Who is calling, and are they allowed to.

Until now every endpoint was open: `/api/admin/users` handed all 29 user
records to anyone who asked, and the only thing standing in front of the
dashboard was a `role === 'ADMIN'` check in the browser — which anyone can
satisfy by typing one line into their own devtools.

This module is the server-side half of that gate. It is deliberately scoped to
the admin surface: ordinary sign-in stays mobile-only, because there is no
password UX for it and adding one would lock out every existing account.
"""
import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config.settings import settings

logger = logging.getLogger(__name__)

#: auto_error=False so a missing header produces our own 401 with a useful
#: message instead of FastAPI's bare "Not authenticated".
_bearer = HTTPBearer(auto_error=False)

ADMIN_ROLE = "ADMIN"


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


async def require_admin(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Reject anything that isn't a live token belonging to an ADMIN.

    Applied to the whole admin router, so a new admin endpoint is protected by
    existing — the failure mode of a per-route decorator is that somebody adds
    route number nine and forgets."""
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in as an administrator to view this.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = decode_token(creds.credentials)
    if claims is None:
        # Covers a bad signature, a tampered payload, and an expired token
        # alike — the caller learns it needs to sign in again, and nothing more.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if claims.get("role") != ADMIN_ROLE:
        # 403, not 401: the token is perfectly valid, the account simply isn't
        # allowed here. Re-authenticating would not help.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="This area is restricted to administrators.")
    return claims


async def require_self_or_admin(
    user_id: str,
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """For a `/…/user/{user_id}` route: the record's own owner, or an admin.

    Plain `require_admin` is too strict here — these routes are how an
    ordinary signed-in user reads their OWN history (e.g. their own buy
    requests), which isn't an admin action. But leaving them open to anyone is
    an IDOR: swap the user_id in the URL and read a stranger's name, mobile
    and city. This is the middle ground: a valid token is required, and it
    must either belong to `user_id` or to an admin.

    `user_id` is bound from the route's own path parameter — FastAPI matches
    same-named path params across a route and its dependencies automatically.
    """
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to view this.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = decode_token(creds.credentials)
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if claims.get("role") == ADMIN_ROLE or claims.get("sub") == user_id:
        return claims

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only view your own requests.")

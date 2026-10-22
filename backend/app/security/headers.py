"""Security headers on every response.

  X-Content-Type-Options: nosniff
      Browsers must trust the Content-Type we send and never "guess". This is
      what stops an uploaded file from ever being run as a web page.
  Referrer-Policy: strict-origin-when-cross-origin
      When a page links elsewhere, the other site learns only "pawbuddy.in",
      never the full address (which can carry ids).
  Permissions-Policy: camera=(), microphone=(), geolocation=()
      Nothing served by the API may ask for the camera, microphone or location.
  Framing (who may show our responses inside their page):
      everything:           X-Frame-Options: DENY + frame-ancestors 'none'
      the document viewer:  frame-ancestors <the CORS_ORIGINS>, only
      The health vault previews a stored document in an <iframe> pointing at
      /api/health-vault/documents/{id}/file (app/health/DocumentVault.jsx), so
      a blanket DENY would blank every preview. That one path may be framed by
      our own site - and by no one else.

Applied in dev as well as production, so a header that would break something
shows up on a laptop before it shows up on the live site.
"""
import re

from starlette.datastructures import MutableHeaders

FRAMEABLE = re.compile(r"^/api/health-vault/documents/[^/]+/file/?$")


class SecurityHeaders:
    def __init__(self, app, frame_origins: list):
        self.app = app
        self.frame_ancestors = " ".join(frame_origins) or "'none'"

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        frameable = bool(FRAMEABLE.match(scope.get("path", "")))

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.setdefault("X-Content-Type-Options", "nosniff")
                headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
                headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
                if frameable:
                    headers.setdefault("Content-Security-Policy", f"frame-ancestors {self.frame_ancestors}")
                else:
                    headers.setdefault("X-Frame-Options", "DENY")
                    headers.setdefault("Content-Security-Policy", "frame-ancestors 'none'")
            await send(message)

        await self.app(scope, receive, send_with_headers)

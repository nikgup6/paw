"""Cap the size of request bodies on chosen paths.

A tracking event is a few hundred bytes. Without a cap, one request could
carry megabytes of junk into the database (and be repeated up to the rate
limit). The cap is enforced HERE, before the app sees the request:

  1. A declared Content-Length over the limit is refused at once.
  2. Otherwise the body is read in, counting as it arrives, and refused the
     moment it passes the limit - so a client that lies about the size, or
     streams it in pieces without declaring one, is caught too.
  3. Within the limit, the body is handed to the app unchanged.

Refused requests get 413 "Payload Too Large". Real visitors never see it: the
browser's tracking calls are tiny and ignore any error anyway.

Why not a check inside the route: FastAPI reads and parses the whole body
before any route code or dependency runs, so by then the damage (memory,
parsing time) is already done.
"""
import json
import logging

logger = logging.getLogger(__name__)


async def _too_large(send) -> None:
    body = json.dumps({"detail": "Request too large."}).encode()
    await send({"type": "http.response.start", "status": 413,
                "headers": [(b"content-type", b"application/json"),
                            (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


class BodySizeLimit:
    """ASGI middleware. `limits` maps an exact path to its maximum body bytes;
    every other path is passed straight through, untouched."""

    def __init__(self, app, limits: dict):
        self.app = app
        self.limits = {path.rstrip("/"): size for path, size in limits.items()}

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") not in ("POST", "PUT", "PATCH"):
            return await self.app(scope, receive, send)
        limit = self.limits.get(scope.get("path", "").rstrip("/"))
        if limit is None:
            return await self.app(scope, receive, send)

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = limit + 1
                if declared > limit:
                    logger.warning("Refused a %d-byte body on %s (limit %d).", declared, scope.get("path"), limit)
                    return await _too_large(send)

        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            piece = message.get("body", b"")
            size += len(piece)
            if size > limit:
                logger.warning("Refused an over-limit streamed body on %s (limit %d).", scope.get("path"), limit)
                return await _too_large(send)
            chunks.append(piece)
            if not message.get("more_body", False):
                break

        body = b"".join(chunks)
        replayed = False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()          # after the body: wait for disconnect as usual

        await self.app(scope, replay, send)

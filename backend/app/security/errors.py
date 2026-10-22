"""What a visitor sees when the code hits an error nobody planned for.

One plain sentence and a short reference. The error and its traceback go to the
server log only (masked by log_safety), tagged with the same reference, so a
screenshot from a user can be matched to the log line.

Why this is a middleware and not only @app.exception_handler(Exception):
Starlette runs that handler in its OUTERMOST layer, outside every middleware we
add. Its 500 therefore skipped CORS - the browser then hides the response from
the page behind a CORS error, so the reference could never be shown - and it
skipped the security headers. CatchUnexpected sits INSIDE those layers (it is
added first; see main.py), so its 500 carries both. The exception handler stays
as a last resort for an error inside a middleware itself.
"""
import json
import logging
import secrets

logger = logging.getLogger("app.errors")

MESSAGE = "Something went wrong. Please try again."


def log_and_reference(method: str, path: str, exc: BaseException) -> str:
    ref = secrets.token_hex(4)
    # path only, never the query string, which can carry ids
    logger.error("Unexpected error ref=%s on %s %s", ref, method, path, exc_info=exc)
    return ref


def body_for(ref: str) -> bytes:
    return json.dumps({"detail": MESSAGE, "ref": ref}).encode()


class CatchUnexpected:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = False

        async def watch_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, watch_send)
        except Exception as exc:  # noqa: BLE001 - this is the catch-all, on purpose
            if started:
                raise           # half a response is already out; nothing safe to add
            body = body_for(log_and_reference(scope.get("method", "?"), scope.get("path", "?"), exc))
            await send({"type": "http.response.start", "status": 500,
                        "headers": [(b"content-type", b"application/json"),
                                    (b"content-length", str(len(body)).encode())]})
            await send({"type": "http.response.body", "body": body})

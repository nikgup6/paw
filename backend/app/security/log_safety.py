"""Keep secrets and phone numbers out of the server logs.

Most log lines in this app are written with care. The risk is the ones that
print an error from someone else's library: a database driver's message can
echo the connection string, an HTTP error can include the full URL with an API
key in its query string, a validation error can include the values it rejected.

So instead of trusting every line, one hook runs on EVERY log record from any
logger (ours, uvicorn's, a library's) and masks:

  - credentials inside URLs     mongodb+srv://user:pass@host -> ***:***@host
  - API keys                    AIza..., sk-..., rzp_live_/rzp_test_...
  - login tokens                eyJ...(a JWT) and "Bearer ..." -> [token]
  - Indian mobile numbers       9876543210 / +91 98765 43210 -> ******10

It cannot recognise a one-time password: a 4-6 digit code looks like any other
number. Code that handles OTPs must simply never log them.

Records with nothing to mask are left exactly as they were, which matters for
uvicorn's access log: its formatter needs the record's original arguments.
"""
import logging
import re
import traceback

_RULES = (
    (re.compile(r"([a-z][a-z0-9+.-]*://)[^:/@\s\"']+:[^@\s\"']+@", re.I), r"\1***:***@"),
    (re.compile(r"\bAIza[0-9A-Za-z_-]{20,}"), "[api-key]"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{16,}"), "[api-key]"),
    (re.compile(r"\brzp_(?:live|test)_[A-Za-z0-9]{8,}"), "[api-key]"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"), "[token]"),
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{8,}"), "Bearer [token]"),
    # 10-digit Indian mobiles (start 6-9), optional +91 / 91 in front. Not when
    # glued to other letters or digits, so ids and hex strings are left alone.
    (re.compile(r"(?<![0-9A-Za-z])(?:\+?91[\s-]?)?([6-9]\d{3})[\s-]?(\d{4})(\d{2})(?![0-9A-Za-z])"), r"******\3"),
)


def redact(text: str) -> str:
    for pattern, replacement in _RULES:
        text = pattern.sub(replacement, text)
    return text


_installed = False


def install_log_redaction() -> None:
    """Wrap the logging system's record factory once, so every record is checked."""
    global _installed
    if _installed:
        return
    _installed = True
    make_record = logging.getLogRecordFactory()

    def safe_record(*args, **kwargs):
        record = make_record(*args, **kwargs)
        try:
            message = record.getMessage()
            cleaned = redact(message)
            if cleaned != message and record.name != "uvicorn.access":
                record.msg, record.args = cleaned, None
            if record.exc_info:
                text = "".join(traceback.format_exception(*record.exc_info))
                cleaned_tb = redact(text)
                if cleaned_tb != text:
                    # the formatter prints exc_text instead of re-formatting exc_info
                    record.exc_text, record.exc_info = cleaned_tb.rstrip("\n"), None
        except Exception:  # a logging hook must never break the request it describes
            pass
        return record

    logging.setLogRecordFactory(safe_record)

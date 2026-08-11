"""Thin wrapper around the Cloudinary SDK for health-document uploads.

The Cloudinary SDK is synchronous, so every call is run in a threadpool to keep
the FastAPI event loop responsive. Configuration comes from settings (either the
three CLOUDINARY_* vars, or a single CLOUDINARY_URL that the SDK reads itself).

PDFs are a special case. Cloudinary blocks delivery of anything stored with a
`.pdf` extension unless the account explicitly opts in ("PDF and ZIP files
delivery", off by default), and signing the URL does not bypass it — the stored
file uploads fine but every read comes back 401. So PDFs go in as `raw` assets
with an extension-less public id, which delivers normally, and the backend
serves them with their real content type (see routes/health_vault.py::get_file).
Images are unaffected and keep the default handling.
"""
import logging
import os
import re
import uuid

import cloudinary
import cloudinary.uploader
import cloudinary.utils
import httpx
from starlette.concurrency import run_in_threadpool

from app.config.settings import settings

logger = logging.getLogger(__name__)

_configured = False

PDF_MIME = "application/pdf"
FETCH_TIMEOUT_SECONDS = 30


def is_configured() -> bool:
    """True when Cloudinary credentials are available in the environment."""
    global _configured
    if _configured:
        return True

    has_split = bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )
    has_url = bool(settings.CLOUDINARY_URL or os.getenv("CLOUDINARY_URL"))

    if has_split:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        _configured = True
    elif has_url:
        # The SDK auto-reads CLOUDINARY_URL from the environment.
        if settings.CLOUDINARY_URL:
            os.environ.setdefault("CLOUDINARY_URL", settings.CLOUDINARY_URL)
        cloudinary.config(secure=True)
        _configured = True

    return _configured


def _slug(filename: str) -> str:
    """A safe, extension-less public-id stem taken from the original filename."""
    stem = re.sub(r"\.[^.]+$", "", filename or "")
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("_")
    return (stem or "document")[:60]


async def upload_document(file_bytes: bytes, filename: str, mime_type: str = None) -> dict:
    """Upload raw bytes to Cloudinary and return {secure_url, public_id, resource_type}.

    Images use resource_type='auto' so Cloudinary can still derive thumbnails.
    PDFs are stored as extension-less `raw` assets — see the module docstring for
    why the obvious `.pdf` route can't be delivered.
    """
    if not is_configured():
        raise RuntimeError("Cloudinary is not configured (set CLOUDINARY_* in backend/.env).")

    is_pdf = (mime_type == PDF_MIME) or str(filename or "").lower().endswith(".pdf")

    def _upload():
        if is_pdf:
            return cloudinary.uploader.upload(
                file_bytes,
                public_id=f"{settings.CLOUDINARY_UPLOAD_FOLDER}/{_slug(filename)}_{uuid.uuid4().hex[:8]}",
                resource_type="raw",
            )
        return cloudinary.uploader.upload(
            file_bytes,
            folder=settings.CLOUDINARY_UPLOAD_FOLDER,
            resource_type="auto",
            use_filename=True,
            unique_filename=True,
            filename_override=filename,
        )

    result = await run_in_threadpool(_upload)
    return {
        "secure_url": result["secure_url"],
        "public_id": result["public_id"],
        "resource_type": result.get("resource_type", "image"),
    }


async def upload_photo(file_bytes: bytes, filename: str) -> dict:
    """Store a dog's profile photo. Always an image, so the default handling
    applies and Cloudinary can serve it directly to an <img>."""
    if not is_configured():
        raise RuntimeError("Cloudinary is not configured (set CLOUDINARY_* in backend/.env).")

    def _upload():
        return cloudinary.uploader.upload(
            file_bytes,
            folder=f"{settings.CLOUDINARY_UPLOAD_FOLDER}/dog_photos",
            resource_type="image",
            use_filename=True,
            unique_filename=True,
            filename_override=filename,
        )

    result = await run_in_threadpool(_upload)
    return {"secure_url": result["secure_url"], "public_id": result["public_id"]}


async def fetch_document(url: str) -> bytes:
    """Read a stored original back out of Cloudinary."""
    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def delete_document(public_id: str, resource_type: str = "image") -> None:
    """Best-effort delete of a file from Cloudinary. Never raises."""
    if not is_configured() or not public_id:
        return

    def _destroy():
        return cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)

    try:
        await run_in_threadpool(_destroy)
    except Exception:
        logger.warning("Cloudinary delete failed for public_id=%s", public_id, exc_info=True)

"""Upload checks: what a file really is, and what it carries with it.

WHAT IT REALLY IS. The browser says what a file is (the Content-Type header)
and so does its name (.jpg) - and both are chosen by whoever sends it. A
program renamed to "photo.jpg" arrives labelled image/jpeg. So the type is read
from the file's own first bytes, its "magic number", which every format writes
at the very start:

    JPEG  FF D8 FF                 PNG  89 50 4E 47 0D 0A 1A 0A
    WebP  "RIFF" .... "WEBP"       PDF  "%PDF-"  (allowed anywhere in the first 1 KB)

A Windows program starts "MZ" and matches none of them, so it is refused
whatever it is called. An image must then also DECODE as that type all the way
through (Pillow), which catches a file that only starts like an image.

WHAT IT CARRIES. A phone photo holds EXIF metadata: camera, time, and very
often the GPS position where it was taken - for a dog photo, usually the
owner's home. Photos are re-saved without any of it. Before the orientation
tag goes, the picture is rotated the way the tag said, so a portrait shot does
not come out sideways.

Needs Pillow (requirements.txt).
"""
import io
import warnings
from typing import Optional

#: what each detected kind is stored and served as
KINDS = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "pdf": "application/pdf"}
PHOTO_KINDS = frozenset({"jpeg", "png", "webp"})
DOCUMENT_KINDS = frozenset({"jpeg", "png", "pdf"})

#: An image this many pixels or more is refused. A few KB of PNG can claim to be
#: 50,000 x 50,000 pixels and take gigabytes to open (a "decompression bomb");
#: a 48-megapixel phone camera is under this.
MAX_IMAGE_PIXELS = 60_000_000

#: Vaccination cards are often phone photos as well, with the same GPS data.
#: Off, because the brief asked for dog photos only and these images also go to
#: the document AI. Turning it on re-saves document images at high quality with
#: no metadata - recommended; see docs/SECURITY.md.
STRIP_DOCUMENT_IMAGE_METADATA = False


class UploadRejected(ValueError):
    """The file is not what it claims to be, or cannot be safely read."""


def sniff(data: bytes) -> Optional[str]:
    """The kind of file this really is, from its first bytes; None if unknown."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if b"%PDF-" in data[:1024]:
        return "pdf"
    return None


def clean_image(data: bytes, kind: str) -> bytes:
    """Decode the whole image, then re-save it with no metadata.

    Raises UploadRejected if it does not decode as `kind`, or is too large."""
    from PIL import Image, ImageOps

    with warnings.catch_warnings():
        # Pillow only WARNS between MAX and 2x MAX pixels; make that a refusal too.
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
        try:
            with Image.open(io.BytesIO(data)) as img:
                found = (img.format or "").lower()
                # MPO is a JPEG with extra frames (some phones store depth data that
                # way); its first frame is an ordinary JPEG.
                if found == "mpo":
                    found = "jpeg"
                if found != kind:
                    raise UploadRejected(f"the bytes say {kind} but it decodes as {found or 'nothing'}")
                img.load()
                icc = img.info.get("icc_profile")          # colour profile: kept, it is not personal
                upright = ImageOps.exif_transpose(img)
        except UploadRejected:
            raise
        except (Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise UploadRejected("the image is too large to open safely") from None
        except Exception:
            raise UploadRejected("the image could not be read") from None

    out = io.BytesIO()
    extra = {"icc_profile": icc} if icc else {}
    if kind == "jpeg":
        if upright.mode not in ("RGB", "L"):
            upright = upright.convert("RGB")
        upright.save(out, "JPEG", quality=90, optimize=True, **extra)
    elif kind == "png":
        upright.save(out, "PNG", optimize=True, **extra)
    else:
        upright.save(out, "WEBP", quality=90, **extra)
    # No exif=, no pnginfo=, no xmp=: Pillow writes only what it is handed, so the
    # saved file carries none of the original's metadata.
    return out.getvalue()

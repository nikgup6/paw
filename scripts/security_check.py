"""Security check for Paw Buddy. Read-only: it changes nothing and never prints a
secret value - only setting names, file names and line numbers.

    python scripts/security_check.py          configuration, secret scan, public routes
    python scripts/security_check.py --deps   ...and the dependency audits (pip-audit, npm audit)

Exit code 1 if something must be fixed:
  - ENV=production with an unsafe configuration
  - a real secret (live key, private key, a password in a database URL...) in
    a file git would commit, or in the built JavaScript a browser downloads
  - a PUBLIC route that is not on the reviewed list below (a new endpoint
    added without a sign-in check, until someone decides it should be public)

Run it before every deploy. To check the LIVE configuration, run it with the
live environment variables set (ENV=production, CORS_ORIGINS=..., and so on).
"""
import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

problems = []                       # each one makes the exit code 1


def heading(text):
    print(f"\n=== {text} " + "=" * max(0, 70 - len(text)))


def fail(text):
    problems.append(text)
    print(f"  FAIL  {text}")


def warn(text):
    print(f"  WARN  {text}")


def ok(text):
    print(f"  ok    {text}")


# --------------------------------------------------------------- 1. configuration

def check_configuration():
    heading("1. Configuration (as this machine would start the backend)")
    sys.path.insert(0, str(BACKEND))
    try:
        # Loading the module IS the check: it raises ConfigError on bad config.
        from app.config.settings import settings
    except Exception as exc:  # noqa: BLE001
        if type(exc).__name__ == "ConfigError":
            # ConfigError's text names settings and reasons, never values.
            for line in str(exc).splitlines()[1:]:
                if line.strip().startswith("-"):
                    fail(line.strip()[2:])
        else:
            fail(f"could not load the settings module ({type(exc).__name__})")
        return

    prod = settings.ENV == "production"
    ok(f"ENV={settings.ENV}; MONGODB_URI is set; SECRET_KEY is set (values not shown)")
    if prod:
        ok("production rules passed: SECRET_KEY is 32+ characters and not a placeholder")
        if settings.TRUSTED_PROXY_COUNT == 0:
            warn("TRUSTED_PROXY_COUNT=0 in production: behind Vercel every visitor shares ONE rate limit. Set 1.")
        insecure = [o for o in settings.cors_origins if o.startswith("http://")]
        if insecure:
            warn(f"CORS_ORIGINS has {len(insecure)} plain-http origin(s) in production - the live site should be https only")
        ok(f"CORS_ORIGINS lists {len(settings.cors_origins)} origin(s), no wildcard")
    else:
        warn("ENV is not production: the production-only rules were not applied. "
             "Run with the live environment variables set to check the live config.")
    if not settings.ANTHROPIC_API_KEY:
        print("  info  ANTHROPIC_API_KEY not set: the matchmaker uses the free local parser")


# --------------------------------------------------------------- 2. secret scan

# (kind, regex, severity). FAIL = a real secret must not be in code. REVIEW =
# a password-like constant someone should look at; listed, does not fail.
PATTERNS = [
    ("database URL with a password", re.compile(r"[a-z][a-z0-9+.-]*://([^:/@\s\"'<>]+):([^@\s\"'<>]+)@", re.I), "FAIL"),
    ("Razorpay LIVE key",            re.compile(r"\brzp_live_[A-Za-z0-9]{8,}"), "FAIL"),
    ("Razorpay test key",            re.compile(r"\brzp_test_[A-Za-z0-9]{8,}"), "FAIL"),
    ("sk- API key",                  re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"), "FAIL"),
    ("Google API key",               re.compile(r"\bAIza[0-9A-Za-z_-]{30,}"), "FAIL"),
    ("private key",                  re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "FAIL"),
    ("token (JWT)",                  re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"), "JWT"),
    ("hard-coded SECRET_KEY",        re.compile(r"SECRET_KEY\s*(?::\s*\w+\s*)?=\s*[\"'][^\"']{16,}[\"']"), "FAIL"),
    ("password hashed from a literal", re.compile(r"get_password_hash\(\s*[\"']"), "REVIEW"),
    # a constant NAMED like a password with a literal value. Case matters for
    # PLACEHOLDER: a form field's placeholder="..." attribute is not a password.
    ("password constant",            re.compile(r"(?:(?i:\b\w*(?:password|passwd|pwd)\w*)|\b\w*PLACEHOLDER\w*)\s*[:=]\s*[\"'][^\"'\s]{6,}[\"']"), "REVIEW"),
]


def _jwt_role(token):
    """The role claim of a JWT, read without verifying it (we only classify)."""
    import base64
    try:
        body = token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))).get("role")
    except Exception:  # noqa: BLE001
        return None


def _shared_placeholder():
    """The password every non-admin account used to share (security item D).
    Contact capture removed it from backend/app/routes/auth.py, so it is read
    from the last commit that still had it - never written into this script -
    and every file is still searched for it. None if neither has it."""
    pat = re.compile(r'_SHARED_PLACEHOLDER\s*=\s*"([^"]+)"')
    rel = "backend/app/routes/auth.py"
    try:
        m = pat.search((ROOT / rel).read_text(encoding="utf-8"))
        if m:
            return m.group(1)
        # Commits that added or removed it; the version on one side of each has it.
        shas = subprocess.run(["git", "-C", str(ROOT), "log", "--format=%H", "-S", "_SHARED_PLACEHOLDER", "--", rel],
                              capture_output=True, text=True, check=True).stdout.split()
        for rev in [r for sha in shas for r in (sha, sha + "~1")]:
            shown = subprocess.run(["git", "-C", str(ROOT), "show", f"{rev}:{rel}"], capture_output=True, text=True)
            m = pat.search(shown.stdout) if shown.returncode == 0 else None
            if m:
                return m.group(1)
    except (OSError, subprocess.CalledProcessError):
        pass
    return None


SHARED = _shared_placeholder()
PLACEHOLDER_CREDS = re.compile(r"(?i)^(user(name)?|pass(word)?|your[_-]?\w*|xxx+|\*+|example|<.*>|\$\{.*\})$")
TEXT_SUFFIXES = {".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".txt", ".html", ".css", ".env", ".example",
                 ".yml", ".yaml", ".toml", ".cfg", ".ini", ".cjs", ".mjs", ".sh", ".ps1", ".bat", ".cmd"}
SELF = Path(__file__).resolve()


def files_git_would_commit():
    """Tracked files plus untracked files git would pick up (not ignored)."""
    try:
        out = subprocess.run(["git", "-C", str(ROOT), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                             capture_output=True, check=True).stdout
        return [ROOT / p for p in out.decode("utf-8", "replace").split("\0") if p]
    except Exception:  # noqa: BLE001 - not a git repo: walk, skipping what .gitignore would
        skip = {"node_modules", "dist", ".git", "__pycache__", ".venv", "venv", ".vite"}
        found = []
        for dp, dns, fns in os.walk(ROOT):
            dns[:] = [d for d in dns if d not in skip]
            found += [Path(dp) / f for f in fns if not f.startswith(".env") or f.endswith(".example")]
        return found


def scan_file(path, label):
    findings = []
    try:
        if path.stat().st_size > 5_000_000:
            return findings
        with io.open(path, encoding="utf-8", errors="ignore") as fh:
            for n, line in enumerate(fh, 1):
                for kind, rx, severity in PATTERNS:
                    m = rx.search(line)
                    if not m:
                        continue
                    if kind == "database URL with a password" and (
                            PLACEHOLDER_CREDS.match(m.group(1)) or PLACEHOLDER_CREDS.match(m.group(2))):
                        continue
                    if severity == "JWT":
                        role = _jwt_role(m.group(0))
                        if role == "anon":
                            severity, kind = "REVIEW", ("Supabase anon key - public by design, safe only "
                                                        "if every table has Row Level Security on")
                        else:
                            severity, kind = "FAIL", f"token with role {role or 'unknown'}"
                    findings.append((severity, f"{label}:{n}", kind))
                if SHARED and SHARED in line:
                    findings.append(("REVIEW", f"{label}:{n}", "the old shared placeholder password (no longer accepted; remove it)"))
    except OSError:
        pass
    return findings


def check_secrets():
    heading("2. Secrets in files (locations only, never values)")
    findings = []
    for p in files_git_would_commit():
        if p.resolve() == SELF or p.suffix.lower() not in TEXT_SUFFIXES and not p.name.startswith(".env"):
            continue
        findings += scan_file(p, p.relative_to(ROOT).as_posix())

    # Anything in the built bundle is downloaded by every visitor.
    dist = FRONTEND / "dist" / "assets"
    if dist.is_dir():
        for p in sorted(dist.glob("*.js")):
            findings += scan_file(p, f"[shipped to browsers] {p.relative_to(ROOT).as_posix()}")

    for severity, where, kind in sorted(findings):
        (fail if severity == "FAIL" else warn)(f"{where}  {kind}{'  (review)' if severity == 'REVIEW' else ''}")
    if not findings:
        ok("nothing found")
    print("  note  .env files are git-ignored and are not scanned; keep every real value there or in the host's settings")
    print("  note  if this project is ever pushed, also check its HISTORY: git log -p -S \"mongodb+srv\" --oneline --all")
    print("        (that prints matching changes; run it yourself and do not paste the output anywhere)")


# --------------------------------------------------------------- 3. public routes

# Reviewed 2026-10-21 (contact form added 2026-10-22). Public on purpose; every write here is rate-limited.
DELIBERATELY_PUBLIC = {
    ("GET", "/"),
    ("POST", "/api/auth/register"), ("POST", "/api/auth/quick-register"), ("POST", "/api/auth/login"),
    ("POST", "/api/auth/contact"),   # contact capture, 60/hour per connection + 3/hour per number
    ("POST", "/api/feedback/pulse"), ("POST", "/api/feedback/screener"),   # answer codes; 200/h per connection, 10/h per visit
    ("GET", "/api/feedback/pulse/status"),   # booleans and question keys only
    # TEMPORARY until OTP: number-only sign-in, allowlisted numbers that own a dog
    # only; 5/h per connection, 3/h per number. Delete with the endpoint.
    ("POST", "/api/auth/legacy-login"),
    ("GET", "/api/breeds/"), ("GET", "/api/breeds/{breed_id}"),
    ("POST", "/api/quiz/submit"), ("POST", "/api/buy"), ("POST", "/api/matchmaker/parse"),
    ("POST", "/api/funnel/events"), ("POST", "/api/funnel/progress"), ("POST", "/api/analytics/visit"),
    ("POST", "/api/feedback"), ("POST", "/api/feedback/experience"), ("POST", "/api/owner-survey/submit"),
    ("GET", "/api/care-tips/match"), ("GET", "/api/care-tips/teaser"),
    # Paywall: status answers mode + price to anyone (the quiz asks before sign-in);
    # the webhook is called by Razorpay and proven by its signature, not a sign-in.
    ("GET", "/api/paywall/status"), ("POST", "/api/paywall/webhook"),
}
# Item F of the security review: the dog features run on a per-device owner id
# with no sign-in. Public by design until that is redesigned (docs/SECURITY.md).
#: Dog profiles and their records. Since review item 7 every one of these must
#: need a sign-in; a public one is a FAIL (there is no "public by design" any more).
DOG_SCOPED_PREFIXES = ("/api/dogs", "/api/daily-care", "/api/health-vault", "/api/vaccination-documents",
                       "/api/care-tips/for-dog", "/api/pets")

ROUTE_PROBE = r'''
import json, os, secrets, sys
os.environ.update({"ENV": "dev", "MONGODB_URI": "mongodb://localhost:1/never_connected",
                   "SECRET_KEY": secrets.token_urlsafe(48), "CORS_ORIGINS": "http://localhost:5173"})
sys.path.insert(0, %r)
from app.main import app
from app.auth import dependencies as d
GATES = {d.require_admin: "admin", d.require_self_or_admin: "owner or admin", d.require_user: "signed in",
         d.optional_user: "optional"}
def calls(x, out):
    c = getattr(x, "call", None) or getattr(x, "dependency", None)
    if c is not None: out.append(c)
    for s in getattr(x, "dependencies", []) or []: calls(s, out)
    return out
def routes():
    for r in app.routes:
        if type(r).__name__ == "_IncludedRouter":
            for s in r.original_router.routes:
                if hasattr(s, "dependant"):
                    yield r.include_context.prefix + s.path, s.methods, list(r.include_context.dependencies) + [s.dependant]
        elif hasattr(r, "dependant"):
            yield r.path, r.methods, [r.dependant]
rows = []
for path, methods, deps in routes():
    fns = [c for dep in deps for c in calls(dep, [])]
    gate = next((g for f, g in GATES.items() if f in fns), "none")
    for m in sorted(methods or []):
        if m not in ("HEAD", "OPTIONS"): rows.append([m, path, gate])
print("ROUTES:" + json.dumps(rows))
'''


def check_routes():
    heading("3. Routes with no sign-in check")
    env = {k: v for k, v in os.environ.items() if k not in ("ENV", "MONGODB_URI", "SECRET_KEY", "CORS_ORIGINS")}
    p = subprocess.run([sys.executable, "-c", ROUTE_PROBE % str(BACKEND)], cwd=str(BACKEND),
                       env=env, capture_output=True, text=True)
    line = next((l for l in p.stdout.splitlines() if l.startswith("ROUTES:")), None)
    if not line:
        fail("could not load the app to list its routes")
        return
    rows = json.loads(line[7:])
    gated = sum(1 for _, _, g in rows if g in ("admin", "owner or admin", "signed in"))
    public = [(m, path, g) for m, path, g in rows if g in ("none", "optional")]
    dog = [r for r in public if r[1].startswith(DOG_SCOPED_PREFIXES)]
    reviewed = [r for r in public if (r[0], r[1]) in DELIBERATELY_PUBLIC and r not in dog]
    unknown = [r for r in public if r not in dog and r not in reviewed]
    dog_total = sum(1 for r in rows if r[1].startswith(DOG_SCOPED_PREFIXES))
    ok(f"{len(rows)} routes: {gated} need a sign-in, {len(reviewed)} public on purpose, "
       f"{dog_total} dog-scoped ({dog_total - len(dog)} of them signed in)")
    for m, path, _ in dog:
        fail(f"DOG     {m:6} {path}  is dog-scoped but needs no sign-in")
    if not dog:
        ok("every dog-scoped route needs a sign-in")
    for m, path, _ in unknown:
        fail(f"REVIEW  {m:6} {path}  is public and not on the reviewed list")
    if not unknown:
        ok("no unreviewed public routes")


# --------------------------------------------------------------- 4. dependencies

def check_dependencies():
    heading("4. Dependency audits (report only - nothing is upgraded)")
    try:
        import pip_audit  # noqa: F401
        p = subprocess.run([sys.executable, "-m", "pip_audit", "-r", str(BACKEND / "requirements.txt"), "--progress-spinner", "off"],
                           capture_output=True, text=True)
        print("  pip-audit:\n" + "\n".join("    " + l for l in (p.stdout or p.stderr).strip().splitlines()))
    except ImportError:
        print("  pip-audit is not installed, so the Python packages were not audited.")
        print("    To install it:  python -m pip install pip-audit   (then run this with --deps again)")

    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        print("  npm not found; frontend not audited.")
        return
    p = subprocess.run([npm, "audit", "--json"], cwd=str(FRONTEND), capture_output=True, text=True)
    try:
        data = json.loads(p.stdout)
    except ValueError:
        print("  npm audit gave no readable report.")
        return
    counts = data.get("metadata", {}).get("vulnerabilities", {})
    print("  npm audit: " + ", ".join(f"{k} {v}" for k, v in counts.items() if k != "total" and v) + f" (total {counts.get('total', 0)})")
    for name, v in sorted(data.get("vulnerabilities", {}).items()):
        fix = v.get("fixAvailable")
        how = ("fix needs a MAJOR upgrade - decide by hand" if isinstance(fix, dict) and fix.get("isSemVerMajor")
               else "fix available within the current major version" if fix else "no fix yet")
        print(f"    {v.get('severity', '?'):8} {name:28} {'direct' if v.get('isDirect') else 'indirect'}  - {how}")


# --------------------------------------------------------------- main

if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass
    ap = argparse.ArgumentParser(description="Read-only security check. Never prints secret values.")
    ap.add_argument("--deps", action="store_true", help="also run pip-audit (if installed) and npm audit")
    args = ap.parse_args()

    check_configuration()
    check_secrets()
    check_routes()
    if args.deps:
        check_dependencies()

    heading("Result")
    if problems:
        print(f"  {len(problems)} thing(s) to fix before going live (marked FAIL above).")
        sys.exit(1)
    print("  Nothing to fix. Items marked WARN are worth a look.")

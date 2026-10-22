"""Print a brand-new random SECRET_KEY for the backend.

    python scripts/gen_secret.py

Paste the output into backend/.env on this machine, and into the host's
environment settings (Vercel: Project -> Settings -> Environment Variables) for
the live site. Use a DIFFERENT key for each: a key that has been on your laptop
should not also sign tokens for real users.

Every run prints a new key. Changing the key signs everybody out once - every
token signed with the old key stops working - which is exactly what you want
after a key has leaked.

Uses only the standard library: `secrets` is Python's module for exactly this.
48 random bytes come out as 64 URL-safe characters, well over the 32 the
backend insists on in production.
"""
import secrets

if __name__ == "__main__":
    print(secrets.token_urlsafe(48))

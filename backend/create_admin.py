"""Create the admin account, or change its password.

    python create_admin.py                    create an admin (asks for everything)
    python create_admin.py --reset-password   change an existing admin's password

The password is typed at a hidden prompt, twice. It is never written to this
file, the terminal or the log - the old version of this script had the password
hard-coded here AND printed it in its success message.

Run it from backend/, with MONGODB_URI and SECRET_KEY set (backend/.env).
"""
import argparse
import asyncio
import getpass
import logging
import sys
import uuid
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient

from app.auth.security import get_password_hash
from app.config.settings import settings
from app.models.user import UserInDB

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("create_admin")

ADMIN_ROLE = "ADMIN"
MIN_ADMIN_PASSWORD = 12
#: A password containing any of these is refused, whatever its length. A rule,
#: not a list of specific passwords - a list would put real passwords in the code.
WEAK_PARTS = ("admin", "pawbuddy", "password", "qwerty", "123456")


def masked(mobile: str) -> str:
    """The last two digits only - enough to tell accounts apart in a log."""
    digits = "".join(ch for ch in mobile if ch.isdigit())
    return f"******{digits[-2:]}" if len(digits) >= 2 else "******"


def ask_password() -> str:
    while True:
        first = getpass.getpass(f"New admin password (at least {MIN_ADMIN_PASSWORD} characters, hidden): ")
        if len(first) < MIN_ADMIN_PASSWORD:
            print(f"Too short - use at least {MIN_ADMIN_PASSWORD} characters.")
            continue
        lowered = first.lower()
        if any(part in lowered for part in WEAK_PARTS) or first.isdigit():
            print("Too easy to guess - pick something else.")
            continue
        if getpass.getpass("Type it again: ") != first:
            print("They don't match - try again.")
            continue
        return first


def ask(prompt: str, default: str = "") -> str:
    value = input(f"{prompt}{f' [{default}]' if default else ''}: ").strip()
    return value or default


def database(client):
    # Same choice as app/database/connection.py: the database named in the URI,
    # or paw_buddy if the URI names none.
    try:
        return client.get_default_database()
    except Exception:
        return client["paw_buddy"]


async def create(users) -> int:
    mobile = ask("Admin mobile number")
    if not mobile:
        print("A mobile number is required.")
        return 1
    existing = await users.find_one({"mobile": mobile})
    if existing:
        if existing.get("role") == ADMIN_ROLE:
            print("An admin with that number already exists. To change its password run:\n"
                  "    python create_admin.py --reset-password")
        else:
            print("That number belongs to an ordinary user account. Not changing it.")
        return 1

    name = ask("Name", "Admin")
    email = ask("Email", "admin@pawbuddy.in")
    password = ask_password()

    admin = UserInDB(
        id=str(uuid.uuid4()),
        name=name,
        mobile=mobile,
        city="",
        email=email,
        role=ADMIN_ROLE,
        pwd_hash=get_password_hash(password),
        created_at=datetime.utcnow(),
    )
    await users.insert_one(admin.dict())
    log.info("Admin account created for mobile %s.", masked(mobile))
    return 0


async def reset_password(users) -> int:
    mobile = ask("Mobile number of the admin account")
    admin = await users.find_one({"mobile": mobile, "role": ADMIN_ROLE})
    if not admin:
        print("No admin account with that number.")
        return 1
    password = ask_password()
    await users.update_one({"_id": admin["_id"]}, {"$set": {"pwd_hash": get_password_hash(password)}})
    log.info("Password changed for admin %s. Sessions signed in before now end when "
             "their token expires (at most %s minutes).", masked(mobile), settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return 0


async def main(reset: bool) -> int:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        users = database(client)["users"]
        return await (reset_password(users) if reset else create(users))
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create the Paw Buddy admin account, or change its password.")
    parser.add_argument("--reset-password", action="store_true", help="change an existing admin's password")
    sys.exit(asyncio.run(main(parser.parse_args().reset_password)))

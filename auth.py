"""Lightweight account authentication & session management for Untold Trails."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from mailer import send_otp_email

ROOT_DIR = Path(__file__).resolve().parent
USERS_FILE = ROOT_DIR / "users.json"
SECRET_FILE = ROOT_DIR / ".auth_secret"
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days
OTP_TTL_SECONDS = 300  # 5 minutes
OTP_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 5


class UnverifiedAccountError(ValueError):
    """Raised when an unverified user attempts to log in."""


def _get_secret() -> bytes:
    env_secret = os.getenv("AUTH_SECRET", "").strip()
    if env_secret:
        return env_secret.encode("utf-8")
    if SECRET_FILE.exists():
        raw = SECRET_FILE.read_text(encoding="utf-8").strip()
        if raw:
            return raw.encode("utf-8")
    generated = secrets.token_hex(32)
    SECRET_FILE.write_text(generated, encoding="utf-8")
    return generated.encode("utf-8")


def _load_users() -> List[Dict[str, Any]]:
    if not USERS_FILE.exists():
        return []
    try:
        data = json.loads(USERS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_users(users: List[Dict[str, Any]]) -> None:
    USERS_FILE.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")


def _hash_password(password: str, salt: Optional[str] = None) -> str:
    salt_hex = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 120_000)
    return f"{salt_hex}${dk.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    if "$" not in stored_hash:
        return False
    salt_hex, expected_hex = stored_hash.split("$", 1)
    candidate = _hash_password(password, salt=salt_hex)
    return hmac.compare_digest(candidate, f"{salt_hex}${expected_hex}")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64url(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def create_token(user_id: str) -> str:
    payload = json.dumps({"uid": user_id, "exp": int(time.time()) + TOKEN_TTL_SECONDS}, separators=(",", ":")).encode("utf-8")
    body = _b64url(payload)
    sig = hmac.new(_get_secret(), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64url(sig)}"


def verify_token(token: str) -> Optional[str]:
    if not token or "." not in token:
        return None
    try:
        body, sig_b64 = token.split(".", 1)
        expected_sig = hmac.new(_get_secret(), body.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(_unb64url(sig_b64), expected_sig):
            return None
        payload = json.loads(_unb64url(body).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return str(payload.get("uid", "")) or None
    except Exception:
        return None


VALID_ROLES = ("user", "host", "admin")


def _normalize_role(role: Optional[str]) -> str:
    clean = (role or "user").strip().lower()
    if clean not in VALID_ROLES:
        raise ValueError("Invalid account type. Please choose User, Host, or Admin.")
    return clean


def _hash_otp(otp: str, salt: Optional[str] = None) -> str:
    salt_hex = salt or secrets.token_hex(16)
    digest = hashlib.sha256(f"{salt_hex}:{otp}".encode("utf-8")).hexdigest()
    return f"{salt_hex}${digest}"


def _verify_otp_hash(otp: str, stored_hash: str) -> bool:
    if "$" not in stored_hash:
        return False
    salt_hex, expected_hex = stored_hash.split("$", 1)
    candidate = _hash_otp(otp, salt=salt_hex)
    return hmac.compare_digest(candidate, f"{salt_hex}${expected_hex}")


def _generate_otp() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user.get("role") or "user",
        "verified": bool(user.get("verified", True)),
        "phone": user.get("phone", ""),
        "city": user.get("city", ""),
        "saved_ids": user.get("saved_ids", []),
        "emergency_contacts": user.get("emergency_contacts", []),
        "saved_trips": user.get("saved_trips", []),
        "created_at": user.get("created_at", ""),
    }


def register_user(
    name: str,
    email: str,
    password: str,
    saved_ids: Optional[List[str]] = None,
    role: str = "user",
) -> Dict[str, Any]:
    clean_name = name.strip()
    clean_email = email.strip().lower()
    clean_role = _normalize_role(role)
    if len(clean_name) < 2:
        raise ValueError("Please enter your full name (at least 2 characters).")
    if "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        raise ValueError("Please enter a valid email address.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long.")

    users = _load_users()
    now = int(time.time())
    existing = next((u for u in users if u.get("email", "").lower() == clean_email), None)
    if existing:
        if existing.get("verified", True):
            raise ValueError("An account with this email already exists. Please log in.")
        elapsed = now - int(existing.get("otp_sent_at", 0))
        if elapsed < OTP_COOLDOWN_SECONDS:
            raise ValueError(f"Verification code already sent. Please wait {OTP_COOLDOWN_SECONDS - elapsed}s before requesting another.")

    otp = _generate_otp()
    send_otp_email(clean_email, clean_name, otp)

    otp_hash = _hash_otp(otp)
    if existing:
        existing["name"] = clean_name
        existing["role"] = clean_role
        existing["password_hash"] = _hash_password(password)
        existing["saved_ids"] = list(dict.fromkeys(saved_ids or []))
        existing["verified"] = False
        existing["otp_hash"] = otp_hash
        existing["otp_expires_at"] = now + OTP_TTL_SECONDS
        existing["otp_attempts"] = 0
        existing["otp_sent_at"] = now
    else:
        user_id = f"usr_{secrets.token_hex(6)}"
        new_user = {
            "id": user_id,
            "name": clean_name,
            "email": clean_email,
            "role": clean_role,
            "verified": False,
            "otp_hash": otp_hash,
            "otp_expires_at": now + OTP_TTL_SECONDS,
            "otp_attempts": 0,
            "otp_sent_at": now,
            "phone": "",
            "city": "",
            "password_hash": _hash_password(password),
            "saved_ids": list(dict.fromkeys(saved_ids or [])),
            "emergency_contacts": [],
            "saved_trips": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        users.append(new_user)

    _save_users(users)
    return {
        "requires_verification": True,
        "email": clean_email,
        "cooldown_seconds": OTP_COOLDOWN_SECONDS,
        "message": "A 6-digit verification OTP has been sent to your email address.",
    }


def verify_email_otp(email: str, otp: str) -> Dict[str, Any]:
    clean_email = email.strip().lower()
    clean_otp = otp.strip()
    if not clean_otp.isdigit() or len(clean_otp) != 6:
        raise ValueError("Please enter a valid 6-digit OTP.")

    users = _load_users()
    user = next((u for u in users if u.get("email", "").lower() == clean_email), None)
    if not user:
        raise ValueError("No account found for this email address.")
    if user.get("verified", True):
        return {"verified": True, "email": clean_email, "message": "Email is already verified. Please log in."}

    stored_hash = user.get("otp_hash", "")
    if not stored_hash:
        raise ValueError("No active verification code found. Please click Resend OTP.")

    now = int(time.time())
    if now > int(user.get("otp_expires_at", 0)):
        user.pop("otp_hash", None)
        _save_users(users)
        raise ValueError("This OTP has expired (5-minute limit). Please click Resend OTP.")

    attempts = int(user.get("otp_attempts", 0))
    if attempts >= OTP_MAX_ATTEMPTS:
        user.pop("otp_hash", None)
        _save_users(users)
        raise ValueError("Too many incorrect attempts. Please request a new OTP.")

    if not _verify_otp_hash(clean_otp, stored_hash):
        attempts += 1
        user["otp_attempts"] = attempts
        if attempts >= OTP_MAX_ATTEMPTS:
            user.pop("otp_hash", None)
            _save_users(users)
            raise ValueError("Maximum verification attempts reached. Please request a new OTP.")
        _save_users(users)
        raise ValueError(f"Incorrect OTP. {OTP_MAX_ATTEMPTS - attempts} attempt(s) remaining.")

    user["verified"] = True
    user.pop("otp_hash", None)
    user.pop("otp_expires_at", None)
    user.pop("otp_attempts", None)
    user.pop("otp_sent_at", None)
    _save_users(users)
    return {
        "verified": True,
        "email": clean_email,
        "role": user.get("role", "user"),
        "message": "Email verified successfully! You can now log in.",
    }


def resend_email_otp(email: str) -> Dict[str, Any]:
    clean_email = email.strip().lower()
    users = _load_users()
    user = next((u for u in users if u.get("email", "").lower() == clean_email), None)
    if not user:
        raise ValueError("No account found for this email address.")
    if user.get("verified", True):
        raise ValueError("This account is already verified. Please log in.")

    now = int(time.time())
    elapsed = now - int(user.get("otp_sent_at", 0))
    if elapsed < OTP_COOLDOWN_SECONDS:
        raise ValueError(f"Please wait {OTP_COOLDOWN_SECONDS - elapsed}s before requesting a new OTP.")

    otp = _generate_otp()
    send_otp_email(clean_email, user.get("name", "Traveller"), otp)

    user["otp_hash"] = _hash_otp(otp)
    user["otp_expires_at"] = now + OTP_TTL_SECONDS
    user["otp_attempts"] = 0
    user["otp_sent_at"] = now
    _save_users(users)
    return {
        "sent": True,
        "email": clean_email,
        "cooldown_seconds": OTP_COOLDOWN_SECONDS,
        "message": "A new 6-digit OTP has been sent to your email.",
    }


def authenticate_user(email: str, password: str, role: Optional[str] = None) -> Dict[str, Any]:
    clean_email = email.strip().lower()
    users = _load_users()
    user = next((u for u in users if u.get("email", "").lower() == clean_email), None)
    if not user or not _verify_password(password, user.get("password_hash", "")):
        raise ValueError("Invalid email or password.")
    if user.get("verified") is False:
        raise UnverifiedAccountError("Your email is not verified yet. Please verify with the 6-digit OTP first.")
    if role is not None and str(role).strip():
        requested_role = _normalize_role(role)
        actual_role = user.get("role") or "user"
        if actual_role != requested_role:
            raise ValueError(f"This account is registered as {actual_role.capitalize()}, not {requested_role.capitalize()}.")
    return {"token": create_token(user["id"]), "user": public_user(user)}


def authenticate_google_user(name: str, email: str, role: str = "user") -> Dict[str, Any]:
    """Sign in or register a Google-verified user and return a session token."""
    clean_email = email.strip().lower()
    clean_name = (name or clean_email.split("@")[0]).strip()
    clean_role = _normalize_role(role)
    users = _load_users()
    user = next((u for u in users if u.get("email", "").lower() == clean_email), None)
    if user:
        actual_role = user.get("role") or "user"
        if actual_role != clean_role:
            raise ValueError(f"This Google account is registered as {actual_role.capitalize()}, not {clean_role.capitalize()}.")
        if not user.get("verified", True):
            user["verified"] = True
            user.pop("otp_hash", None)
            _save_users(users)
        return {"token": create_token(user["id"]), "user": public_user(user)}

    user_id = f"usr_{secrets.token_hex(6)}"
    new_user = {
        "id": user_id,
        "name": clean_name,
        "email": clean_email,
        "role": clean_role,
        "verified": True,
        "auth_provider": "google",
        "phone": "",
        "city": "",
        "password_hash": "",
        "saved_ids": [],
        "emergency_contacts": [],
        "saved_trips": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    users.append(new_user)
    _save_users(users)
    return {"token": create_token(user_id), "user": public_user(new_user)}


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    users = _load_users()
    user = next((u for u in users if u.get("id") == user_id), None)
    return public_user(user) if user else None


def update_user_saved_ids(user_id: str, saved_ids: List[str]) -> Optional[Dict[str, Any]]:
    users = _load_users()
    for u in users:
        if u.get("id") == user_id:
            u["saved_ids"] = list(dict.fromkeys(str(x) for x in saved_ids if str(x).strip()))
            _save_users(users)
            return public_user(u)
    return None


def update_user_profile(
    user_id: str,
    phone: Optional[str] = None,
    city: Optional[str] = None,
    emergency_contacts: Optional[List[Dict[str, str]]] = None,
) -> Optional[Dict[str, Any]]:
    users = _load_users()
    for u in users:
        if u.get("id") == user_id:
            if phone is not None:
                u["phone"] = phone.strip()[:30]
            if city is not None:
                u["city"] = city.strip()[:60]
            if emergency_contacts is not None:
                clean_contacts = []
                for c in emergency_contacts[:5]:
                    cname = str(c.get("name", "")).strip()
                    cphone = str(c.get("phone", "")).strip()
                    if cname and cphone:
                        clean_contacts.append({"name": cname[:60], "phone": cphone[:30]})
                u["emergency_contacts"] = clean_contacts
            _save_users(users)
            return public_user(u)
    return None


def save_user_trip(user_id: str, trip: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    users = _load_users()
    for u in users:
        if u.get("id") == user_id:
            trips = u.get("saved_trips", [])
            trip_entry = {
                "id": f"trip_{secrets.token_hex(4)}",
                "title": str(trip.get("title", "Untold Trail")).strip()[:100],
                "city": str(trip.get("city", "Hyderabad")).strip()[:60],
                "days": int(trip.get("days", 2)),
                "budget": int(trip.get("budget", 1200)),
                "travellers": int(trip.get("travellers", 2)),
                "gem_ids": list(trip.get("gem_ids", [])),
                "notes": str(trip.get("notes", "")).strip()[:300],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            trips.insert(0, trip_entry)
            u["saved_trips"] = trips[:25]
            _save_users(users)
            return public_user(u)
    return None


def delete_user_trip(user_id: str, trip_id: str) -> Optional[Dict[str, Any]]:
    users = _load_users()
    for u in users:
        if u.get("id") == user_id:
            u["saved_trips"] = [tr for tr in u.get("saved_trips", []) if tr.get("id") != trip_id]
            _save_users(users)
            return public_user(u)
    return None

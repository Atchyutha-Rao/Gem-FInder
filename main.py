"""FastAPI backend for Untold Trails (single-folder flat layout in Tourist Places)."""

from __future__ import annotations

import json
import os
import re
import socket
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from art import render_gem_svg, render_stay_svg
from auth import (
    UnverifiedAccountError,
    authenticate_google_user,
    authenticate_user,
    delete_user_trip,
    get_user_by_id,
    register_user,
    resend_email_otp,
    save_user_trip,
    update_user_profile,
    update_user_saved_ids,
    verify_email_otp,
    verify_token,
)
from mailer import EmailConfigError, EmailDeliveryError
from planner import generate_grounded_itinerary, haversine_km
from weather import get_batch_gem_weather, get_place_weather

load_dotenv(ROOT_DIR / ".env")

DATA_FILE = ROOT_DIR / "gems.json"
STAYS_FILE = ROOT_DIR / "stays.json"
GUIDES_FILE = ROOT_DIR / "guides.json"
BOOKINGS_FILE = ROOT_DIR / "bookings.json"
BOOKING_REQUESTS_FILE = ROOT_DIR / "booking_requests.json"
MESSAGES_FILE = ROOT_DIR / "messages.json"
NOTIFICATIONS_FILE = ROOT_DIR / "notifications.json"
REVIEWS_FILE = ROOT_DIR / "reviews.json"
GUIDE_REQUESTS_FILE = ROOT_DIR / "guide_requests.json"
SOS_FILE = ROOT_DIR / "sos_alerts.json"

STATIC_ASSETS = {
    "styles.css": "text/css; charset=utf-8",
    "api.js": "application/javascript; charset=utf-8",
    "store.js": "application/javascript; charset=utf-8",
    "i18n.js": "application/javascript; charset=utf-8",
    "components.js": "application/javascript; charset=utf-8",
    "pages_extra.js": "application/javascript; charset=utf-8",
    "pages.js": "application/javascript; charset=utf-8",
    "app.js": "application/javascript; charset=utf-8",
}

app = FastAPI(
    title="Untold Trails API",
    description="Community-powered discovery & grounded AI trip planner for lesser-known Telangana & Andhra Pradesh places.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_json(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_json(path: Path, items: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as fh:
        json.dump(items, fh, indent=2, ensure_ascii=False)


def _load_gems() -> List[Dict[str, Any]]:
    return _load_json(DATA_FILE)


def _save_gems(gems: List[Dict[str, Any]]) -> None:
    _save_json(DATA_FILE, gems)


def _enrich_gem(gem: Dict[str, Any], reviews: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    gid = gem.get("id", "gem_001")
    seed_num = sum(ord(ch) for ch in gid)
    crowd_level = gem.get("crowd_level") or ("Moderate" if seed_num % 4 == 0 else "Low")
    safety_score = gem.get("safety_score") or (88 + (seed_num % 9))
    gem_reviews = [r for r in (reviews or []) if r.get("gem_id") == gid]
    avg_rating = (
        round(sum(r.get("rating", 5) for r in gem_reviews) / len(gem_reviews), 1)
        if gem_reviews
        else gem.get("avg_rating") or round(4.5 + (seed_num % 5) * 0.1, 1)
    )
    return {
        **gem,
        "hidden": gem.get("hidden", True),
        "crowd_level": crowd_level,
        "safety_score": safety_score,
        "avg_rating": avg_rating,
        "review_count": len(gem_reviews),
    }


def _stay_with_stats(stay: Dict[str, Any], reviews: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    sid = stay["id"]
    s_revs = [r for r in (reviews or []) if r.get("stay_id") == sid]
    avg_rating = (
        round(sum(r.get("rating", 5) for r in s_revs) / len(s_revs), 1)
        if s_revs
        else stay.get("rating", 4.7)
    )
    img = stay.get("image") or f"/img/{sid}.svg"
    return {
        **stay,
        "image": img,
        "fallback_image": f"/img/{sid}.svg",
        "rating": avg_rating,
        "reviews_count": len(s_revs) if s_revs else stay.get("reviews_count", 0),
        "blocked_dates": stay.get("blocked_dates", []),
    }


def _date_range_strs(check_in: str, check_out: str) -> List[str]:
    try:
        d1 = datetime.strptime(check_in, "%Y-%m-%d").date()
        d2 = datetime.strptime(check_out, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD") from exc
    if d2 <= d1:
        raise HTTPException(status_code=400, detail="Check-out date must be after check-in date")
    days = (d2 - d1).days
    if days > 30:
        raise HTTPException(status_code=400, detail="Maximum stay length is 30 nights")
    return [(d1 + timedelta(days=i)).isoformat() for i in range(days)]


def _push_notification(user_email: str, title: str, message: str, kind: str = "info") -> None:
    if not user_email:
        return
    notes = _load_json(NOTIFICATIONS_FILE)
    notes.append(
        {
            "id": f"notif_{uuid.uuid4().hex[:8]}",
            "user_email": user_email.strip().lower(),
            "title": title,
            "message": message,
            "kind": kind,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    _save_json(NOTIFICATIONS_FILE, notes)


class PlanRequest(BaseModel):
    days: int = Field(default=2, ge=1, le=5)
    interests: List[str] = Field(default_factory=list)
    city: str = Field(default="Hyderabad", min_length=2, max_length=80)
    budget: int = Field(default=1200, ge=200, le=20000)
    travellers: int = Field(default=2, ge=1, le=12)
    travel_style: str = Field(default="cultural & nature", max_length=60)
    lang: str = Field(default="en", max_length=10)


class ProfileUpdateRequest(BaseModel):
    phone: Optional[str] = None
    city: Optional[str] = None
    emergency_contacts: Optional[List[Dict[str, str]]] = None


class SaveTripRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    city: str = Field(default="Hyderabad", max_length=60)
    days: int = Field(default=2, ge=1, le=5)
    budget: int = Field(default=1200, ge=200, le=50000)
    travellers: int = Field(default=2, ge=1, le=12)
    gem_ids: List[str] = Field(default_factory=list)
    notes: str = Field(default="", max_length=300)


class ReviewRequest(BaseModel):
    author: str = Field(..., min_length=2, max_length=80)
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=3, max_length=600)


class BookingCreateRequest(BaseModel):
    stay_id: str
    guest_name: str = Field(..., min_length=2, max_length=80)
    guest_email: str = Field(..., min_length=4, max_length=120)
    check_in: str = Field(..., min_length=8, max_length=20)
    check_out: str = Field(..., min_length=8, max_length=20)
    guests: int = Field(default=2, ge=1, le=10)
    notes: str = Field(default="", max_length=300)


class GuideRequestBody(BaseModel):
    traveller_name: str = Field(..., min_length=2, max_length=80)
    traveller_contact: str = Field(..., min_length=4, max_length=120)
    travel_date: str = Field(..., min_length=4, max_length=40)
    group_size: int = Field(default=2, ge=1, le=15)
    notes: str = Field(default="", max_length=300)


class SosAlertRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None
    address: str = Field(default="", max_length=200)
    message: str = Field(default="", max_length=400)
    place_name: str = Field(default="", max_length=120)
    trip_id: str = Field(default="", max_length=60)
    source: str = Field(default="manual", max_length=30)


class BookingRequestCreate(BaseModel):
    stay_id: str
    check_in: str = Field(..., min_length=8, max_length=20)
    check_out: str = Field(..., min_length=8, max_length=20)
    guests: int = Field(default=2, ge=1, le=10)
    message: str = Field(default="", max_length=400)
    guest_name: Optional[str] = Field(default=None, max_length=80)
    guest_email: Optional[str] = Field(default=None, max_length=120)


class MessageCreateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=600)


class HostStayCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    region: str = Field(..., min_length=2, max_length=100)
    state: str = Field(default="Telangana", max_length=60)
    price_per_night: int = Field(default=1400, ge=300, le=50000)
    max_guests: int = Field(default=4, ge=1, le=16)
    lat: float = Field(default=17.65, ge=-90, le=90)
    lng: float = Field(default=79.45, ge=-180, le=180)
    summary: str = Field(..., min_length=10, max_length=400)
    amenities: List[str] = Field(default_factory=lambda: ["Breakfast Included", "Wi-Fi"])


class HostStayUpdateRequest(BaseModel):
    available: Optional[bool] = None
    price_per_night: Optional[int] = Field(default=None, ge=300, le=50000)
    blocked_dates: Optional[List[str]] = None


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: str = Field(..., min_length=4, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(default="user", max_length=20)
    saved_ids: List[str] = Field(default_factory=list)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=4, max_length=120)
    password: str = Field(..., min_length=1, max_length=128)
    role: Optional[str] = Field(default=None, max_length=20)


class VerifyOtpRequest(BaseModel):
    email: str = Field(..., min_length=4, max_length=120)
    otp: str = Field(..., min_length=6, max_length=6)


class ResendOtpRequest(BaseModel):
    email: str = Field(..., min_length=4, max_length=120)


class SavedSyncRequest(BaseModel):
    saved_ids: List[str] = Field(default_factory=list)


def _require_user(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _require_role(authorization: Optional[str], expected_role: str) -> Dict[str, Any]:
    user = _require_user(authorization)
    if (user.get("role") or "user") != expected_role:
        raise HTTPException(
            status_code=403,
            detail=f"{expected_role.capitalize()} account required. Please log in with a {expected_role.capitalize()} account.",
        )
    return user


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., min_length=10)
    role: str = Field(default="user", max_length=20)


@app.post("/api/auth/register")
def auth_register(req: RegisterRequest) -> Dict[str, Any]:
    try:
        return register_user(req.name, req.email, req.password, req.saved_ids, role=req.role)
    except EmailConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/auth/verify-otp")
def auth_verify_otp(req: VerifyOtpRequest) -> Dict[str, Any]:
    try:
        return verify_email_otp(req.email, req.otp)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/auth/resend-otp")
def auth_resend_otp(req: ResendOtpRequest) -> Dict[str, Any]:
    try:
        return resend_email_otp(req.email)
    except EmailConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/auth/login")
def auth_login(req: LoginRequest) -> Dict[str, Any]:
    try:
        return authenticate_user(req.email, req.password, role=req.role)
    except UnverifiedAccountError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@app.get("/api/auth/google-config")
def auth_google_config() -> Dict[str, Any]:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    return {"enabled": bool(client_id), "client_id": client_id}


@app.post("/api/auth/google")
def auth_google(req: GoogleAuthRequest) -> Dict[str, Any]:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured on the server. Set GOOGLE_CLIENT_ID in .env.",
        )
    import urllib.parse
    import urllib.request

    try:
        verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(req.credential)}"
        with urllib.request.urlopen(verify_url, timeout=10) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Could not verify Google token: {exc}") from exc

    if info.get("aud") != client_id:
        raise HTTPException(status_code=401, detail="Google token audience mismatch.")
    if str(info.get("email_verified", "")).lower() != "true":
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    try:
        return authenticate_google_user(
            name=info.get("name") or info.get("email", "").split("@")[0],
            email=info["email"],
            role=req.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/auth/me")
def auth_me(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    return {"user": _require_user(authorization)}


@app.post("/api/auth/saved")
def auth_sync_saved(
    req: SavedSyncRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    updated = update_user_saved_ids(user["id"], req.saved_ids)
    return {"user": updated}


@app.post("/api/auth/profile")
def auth_update_profile(
    req: ProfileUpdateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    updated = update_user_profile(
        user["id"],
        phone=req.phone,
        city=req.city,
        emergency_contacts=req.emergency_contacts,
    )
    return {"user": updated}


@app.post("/api/auth/trips")
def auth_save_trip(
    req: SaveTripRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    updated = save_user_trip(user["id"], req.model_dump())
    return {"user": updated}


@app.delete("/api/auth/trips/{trip_id}")
def auth_delete_trip(
    trip_id: str,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    updated = delete_user_trip(user["id"], trip_id)
    return {"user": updated}


@app.get("/api/health")
def health() -> Dict[str, Any]:
    gems = _load_gems()
    llm_configured = bool(os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("OPENAI_API_KEY", "").strip())
    return {
        "status": "ok",
        "verified_count": sum(1 for g in gems if g.get("status") == "verified"),
        "pending_count": sum(1 for g in gems if g.get("status") == "pending"),
        "llm_configured": llm_configured,
    }


@app.get("/api/gems")
def list_gems(
    category: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    season: Optional[str] = Query(default=None),
    crowd: Optional[str] = Query(default=None),
    hidden: Optional[str] = Query(default=None),
    max_budget: Optional[int] = Query(default=None),
    q: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    reviews = _load_json(REVIEWS_FILE)
    all_verified = [_enrich_gem(g, reviews) for g in _load_gems() if g.get("status") == "verified"]
    available_states = sorted({g.get("state", "") for g in all_verified if g.get("state")})
    gems = list(all_verified)

    if category and category.lower() != "all":
        gems = [g for g in gems if g.get("category", "").lower() == category.lower()]
    if state and state.lower() != "all":
        gems = [g for g in gems if state.lower() in g.get("state", "").lower() or state.lower() in g.get("region", "").lower()]
    if region and region.lower() != "all":
        gems = [g for g in gems if region.lower() in g.get("region", "").lower()]
    if crowd and crowd.lower() != "all":
        gems = [g for g in gems if g.get("crowd_level", "Low").lower() == crowd.lower()]
    if hidden and hidden.lower() in {"hidden", "true"}:
        gems = [g for g in gems if g.get("hidden", True) is True]
    elif hidden and hidden.lower() in {"popular", "false"}:
        gems = [g for g in gems if g.get("hidden", True) is False]
    if season and season.lower() != "all":
        s_low = season.lower()
        if s_low == "monsoon":
            gems = [g for g in gems if any(m in g.get("best_season", "") for m in ("Jul", "Aug", "Sep", "All"))]
        elif s_low == "winter":
            gems = [g for g in gems if any(m in g.get("best_season", "") for m in ("Oct", "Nov", "Dec", "Jan", "Feb", "All"))]
        elif s_low == "all year":
            gems = [g for g in gems if "all" in g.get("best_season", "").lower()]
    if max_budget is not None and max_budget > 0:
        gems = [g for g in gems if g.get("budget_per_day", 0) <= max_budget]
    if q and q.strip():
        needle = q.strip().lower()
        gems = [
            g
            for g in gems
            if needle in g.get("name", "").lower()
            or needle in g.get("region", "").lower()
            or needle in g.get("state", "").lower()
            or needle in g.get("place_type", "").lower()
            or needle in g.get("summary", "").lower()
            or needle in g.get("story", "").lower()
            or any(needle in t.lower() for t in g.get("tags", []))
        ]

    return {"count": len(gems), "states": available_states, "gems": gems}


@app.get("/api/gems/{gem_id}")
def get_gem(gem_id: str) -> Dict[str, Any]:
    all_gems = _load_gems()
    reviews = _load_json(REVIEWS_FILE)
    raw_target = next((g for g in all_gems if g.get("id") == gem_id), None)
    if not raw_target:
        raise HTTPException(status_code=404, detail="Gem not found")

    target = _enrich_gem(raw_target, reviews)
    verified = [_enrich_gem(g, reviews) for g in all_gems if g.get("status") == "verified" and g.get("id") != gem_id]
    nearby = sorted(
        verified,
        key=lambda g: haversine_km(target["lat"], target["lng"], g["lat"], g["lng"]),
    )[:3]
    nearby_with_dist = [
        {**g, "distance_km": round(haversine_km(target["lat"], target["lng"], g["lat"], g["lng"]), 1)}
        for g in nearby
    ]

    stays = _load_json(STAYS_FILE)
    nearby_stays = sorted(
        stays,
        key=lambda st: haversine_km(target["lat"], target["lng"], st["lat"], st["lng"]),
    )[:2]
    nearby_stays_dist = [
        {
            **_stay_with_stats(st, reviews),
            "distance_km": round(haversine_km(target["lat"], target["lng"], st["lat"], st["lng"]), 1),
        }
        for st in nearby_stays
    ]

    gem_reviews = [r for r in reviews if r.get("gem_id") == gem_id]
    return {
        "gem": target,
        "nearby": nearby_with_dist,
        "nearby_stays": nearby_stays_dist,
        "reviews": list(reversed(gem_reviews)),
    }


@app.get("/api/gems/{gem_id}/reviews")
def list_gem_reviews(gem_id: str) -> Dict[str, Any]:
    reviews = [r for r in _load_json(REVIEWS_FILE) if r.get("gem_id") == gem_id]
    return {"reviews": list(reversed(reviews))}


@app.post("/api/gems/{gem_id}/reviews")
def add_gem_review(gem_id: str, req: ReviewRequest) -> Dict[str, Any]:
    gems = _load_gems()
    if not any(g.get("id") == gem_id for g in gems):
        raise HTTPException(status_code=404, detail="Gem not found")
    reviews = _load_json(REVIEWS_FILE)
    entry = {
        "id": f"rev_{uuid.uuid4().hex[:8]}",
        "gem_id": gem_id,
        "author": req.author.strip(),
        "rating": req.rating,
        "comment": req.comment.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    reviews.append(entry)
    _save_json(REVIEWS_FILE, reviews)
    return {"message": "Review published!", "review": entry}


@app.get("/api/stays")
def list_stays(
    state: Optional[str] = Query(default=None),
    max_price: Optional[int] = Query(default=None),
    amenity: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    reviews = _load_json(REVIEWS_FILE)
    all_stays = [
        _stay_with_stats(s, reviews)
        for s in _load_json(STAYS_FILE)
        if s.get("status", "verified") == "verified"
    ]
    available_states = sorted({s.get("state", "") for s in all_stays if s.get("state")})
    stays = list(all_stays)
    if state and state.lower() != "all":
        stays = [s for s in stays if state.lower() in s.get("state", "").lower() or state.lower() in s.get("region", "").lower()]
    if max_price is not None and max_price > 0:
        stays = [s for s in stays if s.get("price_per_night", 0) <= max_price]
    if amenity and amenity.lower() != "all":
        am_low = amenity.lower()
        stays = [s for s in stays if any(am_low in a.lower() for a in s.get("amenities", []))]
    if q and q.strip():
        needle = q.strip().lower()
        stays = [
            s
            for s in stays
            if needle in s.get("name", "").lower()
            or needle in s.get("region", "").lower()
            or needle in s.get("summary", "").lower()
            or needle in s.get("host_name", "").lower()
        ]
    return {"count": len(stays), "states": available_states, "stays": stays}


@app.get("/api/stays/{stay_id}")
def get_stay(stay_id: str) -> Dict[str, Any]:
    stays = _load_json(STAYS_FILE)
    reviews = _load_json(REVIEWS_FILE)
    target = next((s for s in stays if s.get("id") == stay_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Stay not found")
    similar = [_stay_with_stats(s, reviews) for s in stays if s.get("id") != stay_id][:3]
    stay_reviews = [r for r in reviews if r.get("stay_id") == stay_id]
    return {"stay": _stay_with_stats(target, reviews), "similar": similar, "reviews": list(reversed(stay_reviews))}


@app.get("/api/stays/{stay_id}/reviews")
def list_stay_reviews(stay_id: str) -> Dict[str, Any]:
    reviews = [r for r in _load_json(REVIEWS_FILE) if r.get("stay_id") == stay_id]
    return {"reviews": list(reversed(reviews))}


@app.post("/api/stays/{stay_id}/reviews")
def add_stay_review(stay_id: str, req: ReviewRequest) -> Dict[str, Any]:
    stays = _load_json(STAYS_FILE)
    target = next((s for s in stays if s.get("id") == stay_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Stay not found")
    reviews = _load_json(REVIEWS_FILE)
    entry = {
        "id": f"rev_{uuid.uuid4().hex[:8]}",
        "stay_id": stay_id,
        "stay_name": target["name"],
        "gem_id": None,
        "author": req.author.strip(),
        "rating": req.rating,
        "comment": req.comment.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    reviews.append(entry)
    _save_json(REVIEWS_FILE, reviews)
    return {"message": "Stay review published!", "review": entry}


@app.get("/api/bookings")
def list_bookings(
    email: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user_email = email
    if authorization and authorization.lower().startswith("bearer "):
        uid = verify_token(authorization.split(" ", 1)[1].strip())
        if uid:
            u = get_user_by_id(uid)
            if u:
                user_email = u["email"]
    if not user_email:
        return {"bookings": []}
    bookings = _load_json(BOOKINGS_FILE)
    bookings = [b for b in bookings if b.get("guest_email", "").lower() == user_email.lower()]
    return {"bookings": list(reversed(bookings))}


@app.post("/api/bookings")
def create_booking(
    req: BookingCreateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    stays = _load_json(STAYS_FILE)
    stay = next((s for s in stays if s.get("id") == req.stay_id), None)
    if not stay:
        raise HTTPException(status_code=404, detail="Stay not found")
    if not stay.get("available", True):
        raise HTTPException(status_code=400, detail="This stay is currently not accepting bookings.")
    stay_dates = _date_range_strs(req.check_in, req.check_out)
    blocked = set(stay.get("blocked_dates", []))
    overlap = [d for d in stay_dates if d in blocked]
    if overlap:
        raise HTTPException(status_code=400, detail=f"Selected dates already booked/blocked: {', '.join(overlap[:3])}")
    if req.guests > int(stay.get("max_guests", 4)):
        raise HTTPException(status_code=400, detail=f"Maximum {stay.get('max_guests', 4)} guests allowed for this stay.")

    nights = len(stay_dates)
    total = int(stay.get("price_per_night", 1200)) * nights
    booking_id = f"SY-{uuid.uuid4().hex[:5].upper()}"
    entry = {
        "id": booking_id,
        "booking_code": booking_id,
        "stay_id": stay["id"],
        "stay_name": stay["name"],
        "region": stay["region"],
        "host_name": stay["host_name"],
        "host_contact": stay.get("host_contact", "Via Untold Trails"),
        "image": stay.get("image") or f"/img/{stay['id']}.svg",
        "guest_name": req.guest_name.strip(),
        "guest_email": req.guest_email.strip().lower(),
        "check_in": req.check_in,
        "check_out": req.check_out,
        "dates": f"{req.check_in} – {req.check_out}",
        "nights": nights,
        "guests": req.guests,
        "total": total,
        "notes": req.notes.strip(),
        "status": "Confirmed",
        "upcoming": True,
        "safety_status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    bookings = _load_json(BOOKINGS_FILE)
    bookings.append(entry)
    _save_json(BOOKINGS_FILE, bookings)

    stay["blocked_dates"] = sorted(blocked | set(stay_dates))
    _save_json(STAYS_FILE, stays)
    _push_notification(
        entry["guest_email"],
        "Booking Confirmed",
        f"Your stay at {stay['name']} ({req.check_in} to {req.check_out}) is confirmed ({booking_id}).",
        kind="confirmed",
    )
    return {"message": f"Booking {booking_id} confirmed directly with {stay['host_name']}!", "booking": entry}


@app.post("/api/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str) -> Dict[str, Any]:
    bookings = _load_json(BOOKINGS_FILE)
    for b in bookings:
        if b.get("id") == booking_id:
            b["status"] = "Cancelled"
            b["upcoming"] = False
            b["safety_status"] = "Closed"
            _save_json(BOOKINGS_FILE, bookings)
            # Release blocked dates on stay
            try:
                rel_dates = set(_date_range_strs(b["check_in"], b["check_out"]))
                stays = _load_json(STAYS_FILE)
                for s in stays:
                    if s.get("id") == b.get("stay_id"):
                        s["blocked_dates"] = [d for d in s.get("blocked_dates", []) if d not in rel_dates]
                        _save_json(STAYS_FILE, stays)
                        break
            except Exception:
                pass
            _push_notification(
                b.get("guest_email", ""),
                "Booking Cancelled",
                f"Booking {booking_id} at {b.get('stay_name')} has been cancelled.",
                kind="cancelled",
            )
            return {"message": f"Booking {booking_id} cancelled.", "booking": b}
    raise HTTPException(status_code=404, detail="Booking not found")


@app.post("/api/booking-requests")
def create_booking_request(
    req: BookingRequestCreate,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    stays = _load_json(STAYS_FILE)
    stay = next((s for s in stays if s.get("id") == req.stay_id), None)
    if not stay:
        raise HTTPException(status_code=404, detail="Stay not found")
    if not stay.get("available", True):
        raise HTTPException(status_code=400, detail="This host is not accepting requests right now.")
    stay_dates = _date_range_strs(req.check_in, req.check_out)
    blocked = set(stay.get("blocked_dates", []))
    overlap = [d for d in stay_dates if d in blocked]
    if overlap:
        raise HTTPException(status_code=400, detail=f"Dates unavailable: {', '.join(overlap[:3])}")

    nights = len(stay_dates)
    total = int(stay.get("price_per_night", 1200)) * nights
    entry = {
        "id": f"REQ-{uuid.uuid4().hex[:6].upper()}",
        "traveller_id": user["id"],
        "traveller_name": (req.guest_name or user["name"]).strip(),
        "traveller_email": (req.guest_email or user["email"]).strip().lower(),
        "host_id": stay.get("owner_id", ""),
        "host_name": stay.get("host_name", "Local Host"),
        "host_email": stay.get("owner_email", ""),
        "listing_id": stay["id"],
        "listing_name": stay["name"],
        "region": stay["region"],
        "image": stay.get("image") or f"/img/{stay['id']}.svg",
        "check_in": req.check_in,
        "check_out": req.check_out,
        "dates": f"{req.check_in} – {req.check_out}",
        "nights": nights,
        "guests": req.guests,
        "total": total,
        "message": req.message.strip(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    reqs = _load_json(BOOKING_REQUESTS_FILE)
    reqs.append(entry)
    _save_json(BOOKING_REQUESTS_FILE, reqs)
    if stay.get("owner_email"):
        _push_notification(
            stay["owner_email"],
            "New Stay Request",
            f"{entry['traveller_name']} requested {stay['name']} ({entry['dates']}).",
            kind="request",
        )
    return {"message": f"Request {entry['id']} sent to {stay['host_name']}!", "request": entry}


@app.get("/api/booking-requests")
def list_booking_requests(
    role: str = Query(default="traveller"),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    reqs = _load_json(BOOKING_REQUESTS_FILE)
    if role == "host":
        stays = _load_json(STAYS_FILE)
        owned_ids = {
            s["id"]
            for s in stays
            if s.get("owner_id") == user["id"]
            or (s.get("owner_email") and s.get("owner_email").lower() == user["email"].lower())
            or (not s.get("owner_id") and not s.get("owner_email"))
        }
        filtered = [
            r
            for r in reqs
            if r.get("host_id") == user["id"]
            or r.get("host_email", "").lower() == user["email"].lower()
            or r.get("listing_id") in owned_ids
        ]
    else:
        filtered = [
            r
            for r in reqs
            if r.get("traveller_id") == user["id"] or r.get("traveller_email", "").lower() == user["email"].lower()
        ]
    return {"requests": list(reversed(filtered))}


@app.post("/api/booking-requests/{req_id}/accept")
def accept_booking_request(
    req_id: str,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_role(authorization, "host")
    reqs = _load_json(BOOKING_REQUESTS_FILE)
    target = next((r for r in reqs if r.get("id") == req_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Booking request not found")
    if target.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {target.get('status')}")

    stays = _load_json(STAYS_FILE)
    stay = next((s for s in stays if s.get("id") == target.get("listing_id")), None)
    if not stay:
        raise HTTPException(status_code=404, detail="Associated stay not found")
    stay_dates = _date_range_strs(target["check_in"], target["check_out"])
    blocked = set(stay.get("blocked_dates", []))
    overlap = [d for d in stay_dates if d in blocked]
    if overlap:
        raise HTTPException(status_code=400, detail=f"Dates already blocked: {', '.join(overlap[:3])}")

    target["status"] = "accepted"
    target["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_json(BOOKING_REQUESTS_FILE, reqs)

    stay["blocked_dates"] = sorted(blocked | set(stay_dates))
    _save_json(STAYS_FILE, stays)

    booking_id = f"SY-{uuid.uuid4().hex[:5].upper()}"
    booking = {
        "id": booking_id,
        "booking_code": booking_id,
        "request_id": req_id,
        "stay_id": stay["id"],
        "stay_name": stay["name"],
        "region": stay["region"],
        "host_name": stay.get("host_name", user["name"]),
        "host_contact": stay.get("host_contact", "Via Untold Trails"),
        "image": stay.get("image") or f"/img/{stay['id']}.svg",
        "guest_name": target["traveller_name"],
        "guest_email": target["traveller_email"],
        "check_in": target["check_in"],
        "check_out": target["check_out"],
        "dates": target["dates"],
        "nights": target["nights"],
        "guests": target["guests"],
        "total": target["total"],
        "notes": target.get("message", ""),
        "status": "Confirmed",
        "upcoming": True,
        "safety_status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    bookings = _load_json(BOOKINGS_FILE)
    bookings.append(booking)
    _save_json(BOOKINGS_FILE, bookings)

    _push_notification(
        target["traveller_email"],
        "Your stay request was accepted!",
        f"Your request for {stay['name']} ({target['dates']}) was accepted. Booking {booking_id} is confirmed.",
        kind="accepted",
    )
    return {"message": f"Request {req_id} accepted and booking {booking_id} created!", "request": target, "booking": booking}


@app.post("/api/booking-requests/{req_id}/decline")
def decline_booking_request(
    req_id: str,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _require_role(authorization, "host")
    reqs = _load_json(BOOKING_REQUESTS_FILE)
    target = next((r for r in reqs if r.get("id") == req_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Booking request not found")
    target["status"] = "declined"
    target["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_json(BOOKING_REQUESTS_FILE, reqs)
    _push_notification(
        target.get("traveller_email", ""),
        "Stay Request Declined",
        f"Your request for {target.get('listing_name')} ({target.get('dates')}) could not be accommodated.",
        kind="declined",
    )
    return {"message": f"Request {req_id} declined.", "request": target}


@app.get("/api/host/stays")
def host_my_stays(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = _require_role(authorization, "host")
    reviews = _load_json(REVIEWS_FILE)
    stays = _load_json(STAYS_FILE)
    mine = [
        _stay_with_stats(s, reviews)
        for s in stays
        if s.get("owner_id") == user["id"] or (s.get("owner_email") and s.get("owner_email").lower() == user["email"].lower())
    ]
    return {"stays": mine}


@app.get("/api/host/bookings")
def host_my_bookings(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = _require_role(authorization, "host")
    stays = _load_json(STAYS_FILE)
    my_stays = [
        s
        for s in stays
        if s.get("owner_id") == user["id"]
        or (s.get("owner_email") and s.get("owner_email").lower() == user["email"].lower())
        or (not s.get("owner_id") and not s.get("owner_email"))
    ]
    owned_ids = {s["id"] for s in my_stays}
    all_bookings = _load_json(BOOKINGS_FILE)
    host_bookings = [
        b
        for b in reversed(all_bookings)
        if b.get("stay_id") in owned_ids
    ]
    confirmed = [b for b in host_bookings if b.get("status") != "Cancelled"]
    cancelled = [b for b in host_bookings if b.get("status") == "Cancelled"]
    upcoming = [b for b in host_bookings if b.get("upcoming")]
    total_revenue = sum(int(b.get("total", 0) or 0) for b in confirmed)
    total_guests = sum(int(b.get("guests", 0) or 0) for b in confirmed)
    total_nights = sum(int(b.get("nights", 1) or 1) for b in confirmed)

    by_stay: Dict[str, Dict[str, Any]] = {}
    for b in confirmed:
        sid = b.get("stay_id", "")
        if sid not in by_stay:
            by_stay[sid] = {"stay_id": sid, "stay_name": b.get("stay_name", sid), "bookings": 0, "revenue": 0}
        by_stay[sid]["bookings"] += 1
        by_stay[sid]["revenue"] += int(b.get("total", 0) or 0)

    return {
        "bookings": host_bookings,
        "summary": {
            "total_bookings": len(host_bookings),
            "confirmed_count": len(confirmed),
            "upcoming_count": len(upcoming),
            "cancelled_count": len(cancelled),
            "total_revenue": total_revenue,
            "total_guests": total_guests,
            "total_nights": total_nights,
            "avg_booking_value": round(total_revenue / len(confirmed)) if confirmed else 0,
            "by_stay": list(by_stay.values()),
        },
    }


@app.post("/api/host/stays")
async def host_create_stay(
    name: str = Form(...),
    region: str = Form(...),
    state: str = Form("Telangana"),
    price_per_night: int = Form(1400),
    max_guests: int = Form(4),
    lat: float = Form(17.65),
    lng: float = Form(79.45),
    summary: str = Form(...),
    amenities: str = Form("Breakfast Included,Wi-Fi"),
    photo: Optional[UploadFile] = File(default=None),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_role(authorization, "host")
    stays = _load_json(STAYS_FILE)
    sid = f"stay_{uuid.uuid4().hex[:6]}"

    image_url = f"/img/{sid}.svg"
    if photo and photo.filename:
        ext = Path(photo.filename).suffix.lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
            ext = ".jpg"
        safe_filename = f"upload_{sid}_{uuid.uuid4().hex[:6]}{ext}"
        dest = ROOT_DIR / safe_filename
        content = await photo.read()
        if content:
            dest.write_bytes(content)
            image_url = f"/uploads/{safe_filename}"

    clean_amenities = [a.strip() for a in amenities.split(",") if a.strip()][:8] or ["Breakfast Included", "Wi-Fi"]

    entry = {
        "id": sid,
        "slug": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
        "name": name.strip(),
        "name_te": "",
        "region": region.strip(),
        "state": state.strip(),
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "price_per_night": max(300, price_per_night),
        "max_guests": max(1, min(16, max_guests)),
        "rating": 5.0,
        "trust_score": 92,
        "safety_score": 92,
        "crowd_level": "Low",
        "verified_host": True,
        "host_name": user["name"],
        "host_contact": user.get("phone") or "Via Untold Trails messaging",
        "owner_id": user["id"],
        "owner_email": user["email"],
        "available": True,
        "status": "pending",
        "blocked_dates": [],
        "amenities": clean_amenities,
        "image": image_url,
        "fallback_image": f"/img/{sid}.svg",
        "images": [image_url, f"/img/{sid}.svg"],
        "summary": summary.strip(),
        "source": "host",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    stays.append(entry)
    _save_json(STAYS_FILE, stays)
    return {"message": f"{entry['name']} submitted for admin approval!", "stay": entry}


@app.put("/api/host/stays/{stay_id}")
def host_update_stay(
    stay_id: str,
    req: HostStayUpdateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_role(authorization, "host")
    stays = _load_json(STAYS_FILE)
    for s in stays:
        if s.get("id") == stay_id:
            if s.get("owner_id") and s.get("owner_id") != user["id"] and s.get("owner_email", "").lower() != user["email"].lower():
                raise HTTPException(status_code=403, detail="Not authorized to edit this stay")
            if req.available is not None:
                s["available"] = req.available
            if req.price_per_night is not None:
                s["price_per_night"] = req.price_per_night
            if req.blocked_dates is not None:
                s["blocked_dates"] = sorted(set(str(d).strip() for d in req.blocked_dates if str(d).strip()))
            _save_json(STAYS_FILE, stays)
            return {"message": "Stay listing updated.", "stay": _stay_with_stats(s, _load_json(REVIEWS_FILE))}
    raise HTTPException(status_code=404, detail="Stay not found")


@app.get("/api/requests/{req_id}/messages")
def list_request_messages(
    req_id: str,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _require_user(authorization)
    msgs = [m for m in _load_json(MESSAGES_FILE) if m.get("request_id") == req_id]
    return {"messages": msgs}


@app.post("/api/requests/{req_id}/messages")
def send_request_message(
    req_id: str,
    req: MessageCreateRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    reqs = _load_json(BOOKING_REQUESTS_FILE)
    br = next((r for r in reqs if r.get("id") == req_id), None)
    if not br:
        raise HTTPException(status_code=404, detail="Booking request not found")
    is_traveller = br.get("traveller_email", "").lower() == user["email"].lower() or br.get("traveller_id") == user["id"]
    role = "traveller" if is_traveller else "host"
    entry = {
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "request_id": req_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_role": role,
        "text": req.text.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    msgs = _load_json(MESSAGES_FILE)
    msgs.append(entry)
    _save_json(MESSAGES_FILE, msgs)
    recipient = br.get("host_email") if is_traveller else br.get("traveller_email")
    if recipient:
        _push_notification(recipient, f"New message from {user['name']}", entry["text"][:100], kind="message")
    return {"message": entry}


@app.get("/api/notifications")
def list_notifications(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = _require_user(authorization)
    notes = [n for n in _load_json(NOTIFICATIONS_FILE) if n.get("user_email", "").lower() == user["email"].lower()]
    return {"notifications": list(reversed(notes))}


@app.post("/api/notifications/read-all")
def mark_notifications_read(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = _require_user(authorization)
    notes = _load_json(NOTIFICATIONS_FILE)
    for n in notes:
        if n.get("user_email", "").lower() == user["email"].lower():
            n["read"] = True
    _save_json(NOTIFICATIONS_FILE, notes)
    return {"status": "ok"}


@app.get("/api/guides")
def list_guides(
    state: Optional[str] = Query(default=None),
    language: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    guides = _load_json(GUIDES_FILE)
    if state and state.lower() != "all":
        guides = [g for g in guides if state.lower() in g.get("state", "").lower() or state.lower() in g.get("region", "").lower()]
    if language and language.lower() != "all":
        lang_low = language.lower()
        guides = [g for g in guides if any(lang_low in l.lower() for l in g.get("languages", []))]
    if q and q.strip():
        needle = q.strip().lower()
        guides = [
            g
            for g in guides
            if needle in g.get("name", "").lower()
            or needle in g.get("region", "").lower()
            or needle in g.get("bio", "").lower()
            or any(needle in p.lower() for p in g.get("places_covered", []))
        ]
    return {"count": len(guides), "guides": guides}


@app.post("/api/guides/{guide_id}/request")
def request_guide(guide_id: str, req: GuideRequestBody) -> Dict[str, Any]:
    guides = _load_json(GUIDES_FILE)
    guide = next((g for g in guides if g.get("id") == guide_id), None)
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    reqs = _load_json(GUIDE_REQUESTS_FILE)
    entry = {
        "id": f"GR-{uuid.uuid4().hex[:6].upper()}",
        "guide_id": guide_id,
        "guide_name": guide["name"],
        "region": guide["region"],
        "traveller_name": req.traveller_name.strip(),
        "traveller_contact": req.traveller_contact.strip(),
        "travel_date": req.travel_date,
        "group_size": req.group_size,
        "notes": req.notes.strip(),
        "status": "Requested",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    reqs.append(entry)
    _save_json(GUIDE_REQUESTS_FILE, reqs)
    return {"message": f"Guide request sent to {guide['name']}! Reference: {entry['id']}", "request": entry}


@app.get("/api/safety/sos")
def list_my_sos_alerts(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = _require_user(authorization)
    alerts = [a for a in _load_json(SOS_FILE) if a.get("user_id") == user["id"]]
    return {"alerts": list(reversed(alerts))}


@app.post("/api/safety/sos")
def log_sos_alert(
    req: SosAlertRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user_info = None
    if authorization and authorization.lower().startswith("bearer "):
        uid = verify_token(authorization.split(" ", 1)[1].strip())
        if uid:
            user_info = get_user_by_id(uid)
    contacts = user_info.get("emergency_contacts", []) if user_info else []
    alerts = _load_json(SOS_FILE)
    entry = {
        "id": f"SOS-{uuid.uuid4().hex[:6].upper()}",
        "user_id": user_info["id"] if user_info else "guest",
        "user_name": user_info["name"] if user_info else "Guest Traveller",
        "status": "active",
        "emergency_contact_notified": len(contacts) > 0,
        "contacts_count": len(contacts),
        "location": {
            "lat": req.lat,
            "lng": req.lng,
            "accuracy": req.accuracy,
            "address": req.address,
        },
        "lat": req.lat,
        "lng": req.lng,
        "place_name": req.place_name,
        "trip_id": req.trip_id,
        "source": req.source,
        "message": req.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    alerts.append(entry)
    _save_json(SOS_FILE, alerts)
    return {"message": "SOS alert logged.", "alert": entry}


@app.post("/api/safety/sos/{alert_id}/resolve")
def resolve_sos_alert(
    alert_id: str,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = _require_user(authorization)
    alerts = _load_json(SOS_FILE)
    for a in alerts:
        if a.get("id") == alert_id and a.get("user_id") == user["id"]:
            a["status"] = "resolved"
            a["resolved_at"] = datetime.now(timezone.utc).isoformat()
            _save_json(SOS_FILE, alerts)
            return {"message": f"SOS alert {alert_id} marked resolved.", "alert": a}
    raise HTTPException(status_code=404, detail="SOS alert not found")


@app.get("/api/weather")
async def place_weather(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    best_season: str = Query(default=""),
) -> Dict[str, Any]:
    return await get_place_weather(lat=lat, lng=lng, best_season=best_season)


@app.get("/api/weather/all")
async def all_gems_weather() -> Dict[str, Any]:
    gems = _load_gems()
    return {"weather": await get_batch_gem_weather(gems)}


@app.get("/api/gems/{gem_id}/weather")
async def gem_weather(gem_id: str) -> Dict[str, Any]:
    all_gems = _load_gems()
    target = next((g for g in all_gems if g.get("id") == gem_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Gem not found")
    weather = await get_place_weather(
        lat=target["lat"],
        lng=target["lng"],
        best_season=target.get("best_season", ""),
        category=target.get("category", ""),
    )
    return {"gem_id": gem_id, "name": target["name"], "region": target["region"], **weather}


@app.post("/api/gems")
async def submit_gem(
    name: str = Form(...),
    category: str = Form(...),
    region: str = Form(...),
    state: str = Form("Telangana"),
    lat: float = Form(...),
    lng: float = Form(...),
    summary: str = Form(...),
    story: str = Form(...),
    story_te: str = Form(""),
    best_season: str = Form("Oct-Feb"),
    how_to_reach: str = Form(...),
    budget_per_day: int = Form(800),
    duration_hours: float = Form(3.0),
    support_type: str = Form("guide"),
    support_name: str = Form("Local Community Host"),
    support_contact: str = Form("Community Gate / Sample Listing"),
    tags: str = Form("offbeat,community"),
    submitted_by: str = Form("Community Contributor"),
    photo: Optional[UploadFile] = File(default=None),
) -> Dict[str, Any]:
    gems = _load_gems()
    next_num = len(gems) + 1
    gem_id = f"gem_{next_num:03d}"
    while any(g.get("id") == gem_id for g in gems):
        next_num += 1
        gem_id = f"gem_{next_num:03d}"

    images: List[str] = []
    if photo and photo.filename:
        ext = Path(photo.filename).suffix.lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
            ext = ".jpg"
        safe_filename = f"upload_{gem_id}_{uuid.uuid4().hex[:6]}{ext}"
        dest = ROOT_DIR / safe_filename
        content = await photo.read()
        if content:
            dest.write_bytes(content)
            images.append(f"/uploads/{safe_filename}")

    if not images:
        images = [f"/img/{gem_id}_1.svg", f"/img/{gem_id}_2.svg"]

    clean_tags = [t.strip().lower() for t in tags.split(",") if t.strip()][:6] or ["offbeat", "community"]

    new_gem: Dict[str, Any] = {
        "id": gem_id,
        "name": name.strip(),
        "name_te": "",
        "category": category.strip().lower(),
        "state": state.strip(),
        "region": region.strip(),
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "summary": summary.strip(),
        "story": story.strip(),
        "story_te": story_te.strip() or "కమ్యూనిటీ సభ్యులు అందించిన వివరాల తెలుగు అనువాదం త్వరలో అందుబాటులోకి వస్తుంది.",
        "best_season": best_season.strip(),
        "how_to_reach": how_to_reach.strip(),
        "budget_per_day": max(100, int(budget_per_day)),
        "duration_hours": max(0.5, float(duration_hours)),
        "images": images,
        "image_credit": f"Contributed by {submitted_by.strip() or 'Community Contributor'}",
        "local_support": [
            {
                "type": support_type.strip().lower(),
                "name": support_name.strip() or "Local Community Host",
                "contact": support_contact.strip() or "Available locally",
                "note": "Community-submitted local support contact",
            }
        ],
        "tags": clean_tags,
        "status": "pending",
        "source": "community",
        "submitted_by": submitted_by.strip() or "Community Contributor",
    }

    gems.append(new_gem)
    _save_gems(gems)
    return {
        "message": "Gem submitted for verification! It will appear on the public map once approved in Admin Review.",
        "gem": new_gem,
    }


@app.get("/api/admin/pending")
def admin_overview(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_role(authorization, "admin")
    gems = _load_gems()
    pending = [g for g in gems if g.get("status") == "pending"]
    verified = [g for g in gems if g.get("status") == "verified"]
    rejected = [g for g in gems if g.get("status") == "rejected"]

    by_category: Dict[str, int] = {}
    by_state: Dict[str, int] = {}
    by_source: Dict[str, int] = {"seed": 0, "community": 0}
    for g in verified:
        cat = g.get("category", "other")
        by_category[cat] = by_category.get(cat, 0) + 1
        st = g.get("state", "Other")
        by_state[st] = by_state.get(st, 0) + 1
        src = g.get("source", "seed")
        by_source[src] = by_source.get(src, 0) + 1

    stays = _load_json(STAYS_FILE)
    pending_stays = [s for s in stays if s.get("status") == "pending"]
    verified_stays = [s for s in stays if s.get("status", "verified") == "verified"]

    bookings = _load_json(BOOKINGS_FILE)
    confirmed_bookings = [b for b in bookings if b.get("status") != "Cancelled"]
    total_revenue = sum(int(b.get("total", 0) or 0) for b in confirmed_bookings)
    booking_requests = _load_json(BOOKING_REQUESTS_FILE)
    reviews = _load_json(REVIEWS_FILE)
    guides = _load_json(GUIDES_FILE)
    sos_alerts = _load_json(SOS_FILE)
    from auth import _load_users
    users = _load_users()
    users_by_role: Dict[str, int] = {"user": 0, "host": 0, "admin": 0}
    for u in users:
        r = u.get("role") or "user"
        users_by_role[r] = users_by_role.get(r, 0) + 1

    return {
        "pending": pending,
        "pending_stays": pending_stays,
        "all_gems": gems,
        "all_stays": stays,
        "analytics": {
            "total_gems": len(gems),
            "verified_count": len(verified),
            "pending_count": len(pending),
            "pending_stays_count": len(pending_stays),
            "verified_stays_count": len(verified_stays),
            "total_stays": len(stays),
            "total_bookings": len(bookings),
            "confirmed_bookings": len(confirmed_bookings),
            "total_revenue": total_revenue,
            "total_requests": len(booking_requests),
            "total_reviews": len(reviews),
            "total_guides": len(guides),
            "total_users": len(users),
            "users_by_role": users_by_role,
            "active_sos_count": sum(1 for a in sos_alerts if a.get("status") != "resolved"),
            "total_sos_count": len(sos_alerts),
            "rejected_count": len(rejected),
            "by_category": by_category,
            "by_state": by_state,
            "by_source": by_source,
        },
    }


@app.post("/api/admin/approve/{gem_id}")
def approve_gem(gem_id: str, authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_role(authorization, "admin")
    gems = _load_gems()
    for g in gems:
        if g.get("id") == gem_id:
            g["status"] = "verified"
            _save_gems(gems)
            return {"message": f"{g['name']} approved and published!", "gem": g}
    raise HTTPException(status_code=404, detail="Gem not found")


@app.post("/api/admin/reject/{gem_id}")
def reject_gem(gem_id: str, authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_role(authorization, "admin")
    gems = _load_gems()
    for g in gems:
        if g.get("id") == gem_id:
            g["status"] = "rejected"
            _save_gems(gems)
            return {"message": f"{g['name']} marked as rejected.", "gem": g}
    raise HTTPException(status_code=404, detail="Gem not found")


@app.delete("/api/admin/gems/{gem_id}")
def delete_gem(gem_id: str, authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_role(authorization, "admin")
    gems = _load_gems()
    remaining = [g for g in gems if g.get("id") != gem_id]
    if len(remaining) == len(gems):
        raise HTTPException(status_code=404, detail="Gem not found")
    _save_gems(remaining)
    return {"message": f"Location {gem_id} deleted."}


@app.post("/api/admin/stays/{stay_id}/approve")
def approve_stay(stay_id: str, authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_role(authorization, "admin")
    stays = _load_json(STAYS_FILE)
    for s in stays:
        if s.get("id") == stay_id:
            s["status"] = "verified"
            s["available"] = True
            _save_json(STAYS_FILE, stays)
            return {"message": f"{s['name']} approved and published!", "stay": s}
    raise HTTPException(status_code=404, detail="Stay not found")


@app.post("/api/admin/stays/{stay_id}/reject")
def reject_stay(stay_id: str, authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_role(authorization, "admin")
    stays = _load_json(STAYS_FILE)
    for s in stays:
        if s.get("id") == stay_id:
            s["status"] = "rejected"
            s["available"] = False
            _save_json(STAYS_FILE, stays)
            return {"message": f"{s['name']} rejected.", "stay": s}
    raise HTTPException(status_code=404, detail="Stay not found")


@app.delete("/api/admin/stays/{stay_id}")
def delete_stay(stay_id: str, authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_role(authorization, "admin")
    stays = _load_json(STAYS_FILE)
    remaining = [s for s in stays if s.get("id") != stay_id]
    if len(remaining) == len(stays):
        raise HTTPException(status_code=404, detail="Stay not found")
    _save_json(STAYS_FILE, remaining)
    return {"message": f"Stay {stay_id} deleted."}


@app.post("/api/plan")
async def plan_trip(req: PlanRequest) -> Dict[str, Any]:
    verified = [g for g in _load_gems() if g.get("status") == "verified"]
    if not verified:
        raise HTTPException(status_code=400, detail="No verified gems available in database.")
    plan = await generate_grounded_itinerary(
        verified_gems=verified,
        days=req.days,
        interests=req.interests,
        city=req.city,
        budget=req.budget,
        travel_style=req.travel_style,
        lang=req.lang,
    )
    all_stops = [g for d in plan.get("days", []) for g in d.get("gems", [])]
    stays = _load_json(STAYS_FILE)
    guides = _load_json(GUIDES_FILE)
    rec_stays = []
    if all_stops and stays:
        anchor = all_stops[0]
        rec_stays = [
            _stay_with_stats(st)
            for st in sorted(stays, key=lambda s: haversine_km(anchor["lat"], anchor["lng"], s["lat"], s["lng"]))[:2]
        ]
    rec_guides = guides[:2]
    if all_stops and guides:
        stop_regions = " ".join(s.get("region", "").lower() for s in all_stops)
        matched = [g for g in guides if any(tok in stop_regions for tok in g.get("region", "").lower().replace(",", "").split())]
        if matched:
            rec_guides = matched[:2]
    safety_tips = (
        [
            "అటవీ మరియు జలపాతాల వద్ద ఉదయం వేళల్లోనే సందర్శించండి.",
            "ప్రత్యక్ష వాతావరణ సూచనలను చూసి గొడుగు లేదా త్రాగునీరు తీసుకెళ్ళండి.",
            "అత్యవసర పరిస్థితుల్లో నావిగేషన్‌లోని ఎరుపు SOS బటన్‌ను ఉపయోగించండి.",
        ]
        if req.lang == "te"
        else [
            "Start forest & waterfall visits early morning and return before dusk.",
            "Check live weather packing tips (umbrella/water) before each leg.",
            "Save offline directions and keep the SOS button handy for emergency GPS sharing.",
        ]
    )
    plan["travellers"] = req.travellers
    plan["estimated_group_total"] = req.budget * req.days * req.travellers
    plan["recommended_stays"] = rec_stays
    plan["recommended_guides"] = rec_guides
    plan["safety_tips"] = safety_tips
    return plan


@app.get("/img/{filename}")
def serve_gem_art(filename: str) -> Response:
    stay_match = re.fullmatch(r"(stay_[a-zA-Z0-9_]+|[a-f0-9]{24})\.svg", filename)
    if stay_match:
        stay_id = stay_match.group(1)
        stay = next((s for s in _load_json(STAYS_FILE) if s.get("id") == stay_id), None)
        if not stay:
            stay = {"id": stay_id, "name": "Verified Stay", "region": "India", "price_per_night": 1400}
        return Response(content=render_stay_svg(stay), media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=3600"})

    match = re.fullmatch(r"([a-zA-Z0-9_]+)_([12])\.svg", filename)
    if not match:
        raise HTTPException(status_code=404, detail="Artwork not found")
    gem_id, variant_str = match.group(1), match.group(2)
    gem = next((g for g in _load_gems() if g.get("id") == gem_id), None)
    if not gem:
        gem = {"id": gem_id, "name": "Untold Gem", "category": "nature", "region": "India", "lat": 17.5, "lng": 79.5}
    svg_text = render_gem_svg(gem, variant=int(variant_str))
    return Response(content=svg_text, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=3600"})


@app.get("/uploads/{filename}")
def serve_upload(filename: str) -> FileResponse:
    if not re.fullmatch(r"upload_[a-zA-Z0-9_]+\.(jpg|jpeg|png|webp|svg)", filename):
        raise HTTPException(status_code=404, detail="Upload not found")
    target = ROOT_DIR / filename
    if not target.exists():
        raise HTTPException(status_code=404, detail="Upload not found")
    return FileResponse(str(target))


@app.get("/{asset_name}")
def serve_root_asset(asset_name: str):
    if asset_name in STATIC_ASSETS:
        target = ROOT_DIR / asset_name
        if target.exists():
            return FileResponse(str(target), media_type=STATIC_ASSETS[asset_name])
    index_file = ROOT_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend not found")
    return FileResponse(str(index_file))


@app.get("/")
@app.get("/{full_path:path}")
def serve_spa(full_path: str = "") -> FileResponse:
    index_file = ROOT_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend not found")
    return FileResponse(str(index_file))


def _is_port_available(host: str, port: int) -> bool:
    """Return True if host:port (and localhost loopback) can be bound exclusively."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            s.bind((host, port))
        except OSError:
            return False
    if host in {"127.0.0.1", "localhost"}:
        # Ensure nothing is already serving on IPv6 loopback ::1 on the same port
        try:
            with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s6:
                s6.settimeout(0.1)
                if s6.connect_ex(("::1", port)) == 0:
                    return False
        except OSError:
            pass
    return True


def _find_available_port(host: str, start_port: int, max_offset: int = 50) -> int:
    """Pick start_port if free, otherwise the next available port nearby."""
    for port in range(start_port, start_port + max_offset + 1):
        if _is_port_available(host, port):
            return port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, 0))
        return int(s.getsockname()[1])


def _get_lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    requested_port = int(os.getenv("PORT", "8000"))
    port = _find_available_port(host, requested_port)
    if port != requested_port:
        print(f"Port {requested_port} is already in use; switching to free port {port}.")
    lan_ip = _get_lan_ip()
    print(f"Untold Trails running:")
    print(f"  Windows / Local : http://localhost:{port}")
    if lan_ip and lan_ip != "127.0.0.1":
        print(f"  Mobile (Wi-Fi)  : http://{lan_ip}:{port}")
    uvicorn.run(app, host=host, port=port)

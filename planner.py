"""Grounded AI trip planner for Untold Trails.

Implements Section 11 of SPEC.md:
- Never invents places: receives only verified gems and validates every returned gem_id.
- Supports Gemini API or OpenAI API via server-side environment variables, with 1 retry on invalid JSON.
- Includes a smart geographic-clustering deterministic planner fallback so live demos work reliably even offline or without an LLM key.
"""

from __future__ import annotations

import json
import math
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx


# Approximate coordinates for popular starting hubs in Telangana & Andhra Pradesh
CITY_COORDS: Dict[str, Tuple[float, float]] = {
    "hyderabad": (17.3850, 78.4867),
    "warangal": (17.9689, 79.5941),
    "vijayawada": (16.5062, 80.6480),
    "visakhapatnam": (17.6868, 83.2185),
    "vizag": (17.6868, 83.2185),
    "rajahmundry": (17.0005, 81.8040),
    "kakinada": (16.9891, 82.2475),
    "kurnool": (15.8281, 78.0373),
    "tirupati": (13.6288, 79.4192),
    "nizamabad": (18.6725, 78.0941),
    "adilabad": (19.6641, 78.5320),
    "kadapa": (14.4673, 78.8242),
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
    "kochi": (9.9312, 76.2673),
    "jaipur": (26.9124, 75.7873),
    "delhi": (28.6139, 77.2090),
    "mumbai": (19.0760, 72.8777),
    "leh": (34.1526, 77.5771),
    "shillong": (25.5788, 91.8933),
}


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate great-circle distance in kilometers between two coordinates."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _resolve_city_coords(city: str) -> Tuple[float, float]:
    key = city.strip().lower()
    for known, coords in CITY_COORDS.items():
        if known in key or key in known:
            return coords
    return CITY_COORDS["hyderabad"]


def shortlist_gems(
    verified_gems: List[Dict[str, Any]],
    city: str,
    interests: List[str],
    budget_per_day: int,
    limit: int = 18,
) -> List[Dict[str, Any]]:
    """Filter and score verified gems before passing them to the LLM or fallback planner."""
    start_lat, start_lng = _resolve_city_coords(city)
    interest_set = {i.strip().lower() for i in interests if i.strip()}

    scored: List[Tuple[float, Dict[str, Any]]] = []
    for gem in verified_gems:
        dist = haversine_km(start_lat, start_lng, gem["lat"], gem["lng"])
        score = 0.0
        if not interest_set or gem["category"].lower() in interest_set:
            score += 40.0
        # Tag match bonus
        gem_tags = {t.lower() for t in gem.get("tags", [])}
        score += 8.0 * len(interest_set & gem_tags)
        # Budget friendliness
        if gem.get("budget_per_day", 800) <= budget_per_day * 1.25:
            score += 15.0
        else:
            score -= 10.0
        # Proximity preference (closer is better, gentle decay per 100 km)
        score -= dist / 35.0
        scored.append((score, gem))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [g for _, g in scored[:limit]]


def _extract_json_block(text: str) -> Optional[Dict[str, Any]]:
    """Extract and parse a JSON object from raw LLM output."""
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
    if fence_match:
        text = fence_match.group(1)
    else:
        brace_match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if brace_match:
            text = brace_match.group(0)
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _validate_plan_payload(
    raw_plan: Optional[Dict[str, Any]],
    valid_ids: set[str],
    days: int,
) -> Optional[List[Dict[str, Any]]]:
    """Ensure every returned gem ID exists in our verified DB and structure is sound."""
    if not raw_plan or not isinstance(raw_plan.get("days"), list):
        return None

    seen_ids: set[str] = set()
    cleaned_days: List[Dict[str, Any]] = []
    for idx, day_obj in enumerate(raw_plan["days"][:days], start=1):
        if not isinstance(day_obj, dict):
            continue
        raw_ids = day_obj.get("gem_ids", [])
        if not isinstance(raw_ids, list):
            continue
        verified_day_ids = []
        for gid in raw_ids:
            if isinstance(gid, str) and gid in valid_ids and gid not in seen_ids:
                verified_day_ids.append(gid)
                seen_ids.add(gid)
        if verified_day_ids:
            cleaned_days.append(
                {
                    "day": int(day_obj.get("day", idx)),
                    "gem_ids": verified_day_ids[:3],
                    "why": str(day_obj.get("why", "Curated regional cluster from verified local entries.")),
                    "tip": str(day_obj.get("tip", "Start early and check local timings before travelling.")),
                }
            )
    return cleaned_days if cleaned_days else None


def _build_llm_prompt(
    days: int,
    interests: List[str],
    city: str,
    budget: int,
    travel_style: str,
    shortlist: List[Dict[str, Any]],
    lang: str = "en",
) -> str:
    compact_gems = [
        {
            "id": g["id"],
            "name": g["name"],
            "category": g["category"],
            "region": g["region"],
            "lat": g["lat"],
            "lng": g["lng"],
            "budget_per_day": g["budget_per_day"],
            "duration_hours": g["duration_hours"],
            "best_season": g["best_season"],
            "summary": g["summary"],
        }
        for g in shortlist
    ]
    interests_text = ", ".join(interests) if interests else "heritage, nature, food, culture, village"
    lang_note = (
        "Write the 'why' and 'tip' text in natural, clear Telugu (తెలుగు script)."
        if lang == "te"
        else "Write the 'why' and 'tip' text in clear English."
    )
    return (
        "You are a responsible travel planner for lesser-known places in Telangana and Andhra Pradesh.\n"
        "Use ONLY the places provided in the JSON list below. NEVER invent or add any place not in the list.\n"
        f"Plan a realistic {days}-day trip for a {travel_style} traveller who likes {interests_text}, "
        f"starting from {city}, with an approximate daily budget of INR {budget}.\n"
        "Group geographically nearby places on the same day and keep each day realistic (2 to 3 places per day, max 3).\n"
        f"{lang_note}\n"
        "Return ONLY valid JSON matching this exact schema:\n"
        '{"days": [{"day": 1, "gem_ids": ["gem_001"], "why": "...", "tip": "..."}]}\n'
        f"Places: {json.dumps(compact_gems, ensure_ascii=False)}"
    )


async def _call_gemini(prompt: str, api_key: str) -> Optional[str]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"},
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            return None
        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError):
            return None


async def _call_openai(prompt: str, api_key: str) -> Optional[str]:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "model": "gpt-4o-mini",
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Output valid JSON only. Never invent locations."},
            {"role": "user", "content": prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            return None
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return None


def _deterministic_cluster_plan(
    shortlist: List[Dict[str, Any]],
    days: int,
    city: str,
    interests: List[str],
    budget: int,
    lang: str = "en",
) -> List[Dict[str, Any]]:
    """Fallback planner: groups nearby verified gems into logical daily trails."""
    if not shortlist:
        return []

    start_lat, start_lng = _resolve_city_coords(city)
    remaining = list(shortlist)
    interest_set = {i.strip().lower() for i in interests if i.strip()}
    per_day_target = 2 if len(remaining) < days * 2 else min(3, max(2, len(remaining) // days))

    plan_days: List[Dict[str, Any]] = []
    cur_lat, cur_lng = start_lat, start_lng

    for day_num in range(1, days + 1):
        if not remaining:
            break
        # Pick anchor gem balancing interest fit & distance from current hub
        remaining.sort(
            key=lambda g: (
                -(25 if (not interest_set or g["category"] in interest_set) else 0)
                + haversine_km(cur_lat, cur_lng, g["lat"], g["lng"]) / 25.0
            )
        )
        anchor = remaining.pop(0)
        day_gems = [anchor]

        # Add 1-2 nearest neighbours within reasonable driving range (~140 km)
        while len(day_gems) < per_day_target and remaining:
            remaining.sort(key=lambda g: haversine_km(anchor["lat"], anchor["lng"], g["lat"], g["lng"]))
            nearest = remaining[0]
            if haversine_km(anchor["lat"], anchor["lng"], nearest["lat"], nearest["lng"]) <= 165.0 or len(day_gems) == 1:
                day_gems.append(remaining.pop(0))
            else:
                break

        regions = list(dict.fromkeys(g["region"] for g in day_gems))
        cats = list(dict.fromkeys(g["category"].title() for g in day_gems))
        day_cost = sum(g.get("budget_per_day", 700) for g in day_gems) // max(1, len(day_gems))

        if lang == "te":
            why = (
                f"ప్రయాణ సమయాన్ని తగ్గించడానికి {', '.join(regions)} పరిసరాలలోని "
                f"{len(day_gems)} ధృవీకరించిన ప్రదేశాలను కలిపి రూపొందించిన మార్గం (సుమారు ₹{day_cost}/రోజు)."
            )
            tip = (
                "ఉదయం 7:30 గంటలకే బయలుదేరండి; స్థానిక సహాయ సంప్రదింపుల నంబర్లకు ముందుగా కాల్ చేసి "
                "వాతావరణం & ప్రవేశ సమయాలను సరిచూసుకోండి."
            )
        else:
            why = (
                f"Clusters {len(day_gems)} verified {' & '.join(cats).lower()} stops around "
                f"{' and '.join(regions)} to minimize highway transit (~INR {day_cost}/day avg)."
            )
            tip = (
                f"Start around 7:30 AM from {'your base in ' + city if day_num == 1 else regions[0]}; "
                f"connect with the listed local support contacts before arriving and check live weather."
            )
        plan_days.append(
            {
                "day": day_num,
                "gem_ids": [g["id"] for g in day_gems],
                "why": why,
                "tip": tip,
            }
        )
        cur_lat, cur_lng = day_gems[-1]["lat"], day_gems[-1]["lng"]

    return plan_days


async def generate_grounded_itinerary(
    verified_gems: List[Dict[str, Any]],
    days: int,
    interests: List[str],
    city: str,
    budget: int,
    travel_style: str = "cultural & nature",
    lang: str = "en",
) -> Dict[str, Any]:
    """Generate a multi-day itinerary strictly grounded in verified_gems."""
    days = max(1, min(days, 5))
    shortlist = shortlist_gems(verified_gems, city=city, interests=interests, budget_per_day=budget, limit=18)
    valid_ids = {g["id"] for g in verified_gems}
    gem_lookup = {g["id"]: g for g in verified_gems}

    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    planner_mode = "local-geographic-clustering"
    validated_days: Optional[List[Dict[str, Any]]] = None

    if gemini_key or openai_key:
        prompt = _build_llm_prompt(days, interests, city, budget, travel_style, shortlist, lang=lang)
        for attempt in range(2):  # Initial try + 1 retry if malformed JSON
            raw_text: Optional[str] = None
            try:
                if gemini_key:
                    raw_text = await _call_gemini(prompt, gemini_key)
                    mode_name = "gemini-2.0-flash-grounded"
                elif openai_key:
                    raw_text = await _call_openai(prompt, openai_key)
                    mode_name = "openai-gpt4o-mini-grounded"
                else:
                    mode_name = "local-geographic-clustering"

                if raw_text:
                    parsed = _extract_json_block(raw_text)
                    validated_days = _validate_plan_payload(parsed, valid_ids=valid_ids, days=days)
                    if validated_days:
                        planner_mode = mode_name
                        break
            except Exception:
                # Fall through to retry or deterministic fallback
                pass

    if not validated_days:
        validated_days = _deterministic_cluster_plan(
            shortlist=shortlist,
            days=days,
            city=city,
            interests=interests,
            budget=budget,
            lang=lang,
        )

    # Hydrate full verified gem objects for the frontend
    hydrated_days = []
    for d in validated_days:
        stops = [gem_lookup[gid] for gid in d["gem_ids"] if gid in gem_lookup]
        if stops:
            hydrated_days.append(
                {
                    "day": d["day"],
                    "gem_ids": [s["id"] for s in stops],
                    "gems": stops,
                    "why": d["why"],
                    "tip": d["tip"],
                }
            )

    disclaimer = (
        "సమాచారం & వాతావరణ వివరాలు సూచనార్థం మాత్రమే — ప్రయాణానికి ముందు స్థానిక సమయాలను సరిచూసుకోండి."
        if lang == "te"
        else "Sample community & tourism data — please check local timings and weather before travelling."
    )

    return {
        "city": city,
        "days_requested": days,
        "budget_per_day": budget,
        "travel_style": travel_style,
        "interests": interests,
        "planner_mode": planner_mode,
        "grounded_verified_only": True,
        "disclaimer": disclaimer,
        "days": hydrated_days,
    }

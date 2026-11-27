"""Live weather, 3-day forecast & AI packing/travel suggestions for Untold Trails."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx

_CACHE_TTL_SECONDS = 900  # 15 minutes
_WEATHER_CACHE: Dict[Tuple[float, float, str], Tuple[float, Dict[str, Any]]] = {}

# code -> (label_en, label_te, icon, advice_en, advice_te)
WMO_CODES: Dict[int, Tuple[str, str, str, str, str]] = {
    0: (
        "Clear Sky",
        "నిర్మలమైన ఆకాశం",
        "☀️",
        "Clear skies — ideal for sightseeing and photography.",
        "ఆకాశం నిర్మలంగా ఉంది — సందర్శన మరియు ఫోటోగ్రఫీకి అనుకూలం.",
    ),
    1: (
        "Mainly Clear",
        "ఎక్కువగా నిర్మలం",
        "🌤️",
        "Bright and pleasant — great conditions for trails.",
        "వెలుతురు మరియు ఆహ్లాదకరమైన వాతావరణం — ప్రయాణానికి ఉత్తమం.",
    ),
    2: (
        "Partly Cloudy",
        "పాక్షికంగా మేఘావృతం",
        "⛅",
        "Comfortable cloud cover for outdoor walking.",
        "నడకకు అనుకూలమైన తేలికపాటి మేఘాలు ఉన్నాయి.",
    ),
    3: (
        "Overcast",
        "మేఘావృతం",
        "☁️",
        "Cloudy skies — mild glare, good for heritage walks.",
        "మేఘావృతమైన ఆకాశం — ఆలయాలు, చారిత్రక ప్రదేశాల నడకకు మంచిది.",
    ),
    45: (
        "Misty",
        "పొగమంచు",
        "🌫️",
        "Morning mist possible — allow extra transit time.",
        "ఉదయం పొగమంచు ఉండవచ్చు — ప్రయాణానికి అదనపు సమయం కేటాయించండి.",
    ),
    48: (
        "Dense Fog",
        "దట్టమైన పొగమంచు",
        "🌫️",
        "Low visibility in early hours — drive carefully.",
        "ఉదయం దృశ్యమానత తక్కువగా ఉంటుంది — జాగ్రత్తగా డ్రైవ్ చేయండి.",
    ),
    51: (
        "Light Drizzle",
        "చిరుజల్లులు",
        "🌦️",
        "Light drizzle — carry a compact umbrella.",
        "తేలికపాటి చిరుజల్లులు — చిన్న గొడుగు తీసుకెళ్ళండి.",
    ),
    53: (
        "Drizzle",
        "జల్లులు",
        "🌦️",
        "Intermittent drizzle — trails may be slightly damp.",
        "అక్కడక్కడ జల్లులు — నడక మార్గాలు కొద్దిగా తడిగా ఉండవచ్చు.",
    ),
    55: (
        "Heavy Drizzle",
        "భారీ జల్లులు",
        "🌧️",
        "Steady drizzle — waterproof footwear recommended.",
        "నిరంతర జల్లులు — వాటర్‌ప్రూఫ్ చెప్పులు వాడండి.",
    ),
    61: (
        "Light Rain",
        "తేలికపాటి వర్షం",
        "🌧️",
        "Light rain — pack rain protection for outdoor stops.",
        "తేలికపాటి వర్షం — బయటి ప్రదేశాల కోసం రెయిన్ గేర్ ఉంచుకోండి.",
    ),
    63: (
        "Moderate Rain",
        "మోస్తరు వర్షం",
        "🌧️",
        "Rainy conditions — verify road & waterfall access locally.",
        "వర్షం పడుతోంది — రోడ్డు మరియు జలపాతం అనుమతులను స్థానికంగా సరిచూసుకోండి.",
    ),
    65: (
        "Heavy Rain",
        "భారీ వర్షం",
        "⛈️",
        "Heavy rainfall — avoid slippery rocks and forest streams.",
        "భారీ వర్షం — జారే బండలు మరియు అటవీ వాగులకు దూరంగా ఉండండి.",
    ),
    80: (
        "Light Showers",
        "చిరు వర్షపు జల్లులు",
        "🌦️",
        "Brief passing showers — plan flexible timings.",
        "తాత్కాలిక వర్షపు జల్లులు — సమయాన్ని అనుగుణంగా ప్లాన్ చేయండి.",
    ),
    81: (
        "Rain Showers",
        "వర్షపు జల్లులు",
        "🌧️",
        "Showers expected — carry rain gear.",
        "వర్షపు జల్లులు పడే అవకాశం — గొడుగు లేదా రెయిన్‌కోట్ తీసుకెళ్ళండి.",
    ),
    82: (
        "Heavy Showers",
        "భారీ వర్షపు జల్లులు",
        "⛈️",
        "Intense showers — check local safety alerts.",
        "తీవ్రమైన జల్లులు — స్థానిక భద్రతా సూచనలు పాటించండి.",
    ),
    95: (
        "Thunderstorm",
        "ఉరుములతో కూడిన వర్షం",
        "⛈️",
        "Thunderstorm activity — stay indoors during squalls.",
        "ఉరుములు మెరుపులు — తుఫాను సమయంలో సురక్షిత ప్రాంతంలో ఉండండి.",
    ),
    96: (
        "Storm & Hail",
        "తుఫాను & వడగళ్ళు",
        "⛈️",
        "Severe weather — postpone exposed outdoor treks.",
        "తీవ్ర వాతావరణం — బయటి ట్రెక్కింగ్‌ను వాయిదా వేయండి.",
    ),
    99: (
        "Severe Storm",
        "భారీ తుఫాను",
        "⛈️",
        "Severe thunderstorm — defer travel until clear.",
        "తీవ్ర తుఫాను — వాతావరణం సర్దుకునే వరకు ప్రయాణం వాయిదా వేయండి.",
    ),
}

_DAY_NAMES_TE = {
    "Mon": "సోమ",
    "Tue": "మంగళ",
    "Wed": "బుధ",
    "Thu": "గురు",
    "Fri": "శుక్ర",
    "Sat": "శని",
    "Sun": "ఆది",
}


def _describe_wmo(code: Optional[int], is_day: int = 1) -> Tuple[str, str, str, str, str]:
    if code is None:
        return (
            "Fair Weather",
            "ఆహ్లాదకరమైన వాతావరణం",
            "🌤️",
            "Check local conditions before starting out.",
            "బయలుదేరే ముందు స్థానిక వాతావరణ పరిస్థితులు చూడండి.",
        )
    label_en, label_te, icon, adv_en, adv_te = WMO_CODES.get(
        int(code),
        (
            "Variable Skies",
            "మారుతున్న ఆకాశం",
            "⛅",
            "Check local weather updates before travelling.",
            "ప్రయాణానికి ముందు స్థానిక వాతావరణ సమాచారం తెలుసుకోండి.",
        ),
    )
    if int(code) == 0 and is_day == 0:
        icon = "🌙"
    return (label_en, label_te, icon, adv_en, adv_te)


def _build_ai_suggestions(
    weather_code: Optional[int],
    temp_c: Optional[float],
    humidity: Optional[int],
    wind_kmh: Optional[float],
    max_rain_chance: int,
    category: str = "",
    is_monsoon_season: bool = False,
) -> List[Dict[str, str]]:
    """Generate actionable, weather-driven AI packing & safety suggestions in EN & TE."""
    suggestions: List[Dict[str, str]] = []
    code = int(weather_code) if weather_code is not None else -1
    rain_codes = {51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99}
    storm_codes = {65, 82, 95, 96, 99}

    if code in storm_codes:
        suggestions.append({
            "icon": "⛈️",
            "en": "Avoid waterfalls, hilltops & open water during storms",
            "te": "తుఫాను సమయంలో జలపాతాలు, కొండలు & నీటి ప్రాంతాలకు దూరంగా ఉండండి",
        })

    if code in rain_codes or max_rain_chance >= 35 or is_monsoon_season:
        suggestions.append({
            "icon": "☂️",
            "en": "Carry an umbrella or compact raincoat",
            "te": "గొడుగు లేదా చిన్న రెయిన్‌కోట్ తప్పకుండా తీసుకెళ్ళండి",
        })
        suggestions.append({
            "icon": "👟",
            "en": "Wear waterproof, non-slip grip footwear",
            "te": "జారకుండా ఉండే వాటర్‌ప్రూఫ్ చెప్పులు/బూట్లు ధరించండి",
        })

    if temp_c is not None and temp_c >= 30:
        suggestions.append({
            "icon": "🧢",
            "en": "Pack sunglasses, a sun cap & sunscreen",
            "te": "సన్‌గ్లాసెస్, టోపీ మరియు సన్‌స్క్రీన్ తీసుకెళ్ళండి",
        })
        suggestions.append({
            "icon": "💧",
            "en": "Carry 2L drinking water & ORS hydration packets",
            "te": "2 లీటర్ల త్రాగునీరు మరియు ORS ప్యాకెట్లు ఉంచుకోండి",
        })
        if temp_c >= 33:
            suggestions.append({
                "icon": "🌅",
                "en": "Visit early (6:30–10 AM) to avoid peak afternoon heat",
                "te": "మధ్యాహ్న ఎండ నుండి తప్పించుకోవడానికి ఉదయం 6:30–10 లోపు వెళ్ళండి",
            })
    elif temp_c is not None and temp_c <= 22:
        suggestions.append({
            "icon": "🧥",
            "en": "Carry a light jacket or shawl for cool mornings & evenings",
            "te": "చల్లని ఉదయం/సాయంత్రం కోసం లైట్ జాకెట్ లేదా శాలువా తీసుకెళ్ళండి",
        })

    if code in {45, 48}:
        suggestions.append({
            "icon": "🚗",
            "en": "Drive slowly with fog lights on early ghat roads",
            "te": "పొగమంచు కారణంగా ఘాట్ రోడ్లపై ఫాగ్ లైట్లతో నెమ్మదిగా వెళ్ళండి",
        })

    if humidity is not None and humidity >= 75:
        suggestions.append({
            "icon": "👕",
            "en": "Wear breathable cotton clothing for humid weather",
            "te": "తేమ ఎక్కువగా ఉన్నందున తేలికపాటి కాటన్ దుస్తులు ధరించండి",
        })

    if wind_kmh is not None and wind_kmh >= 18:
        suggestions.append({
            "icon": "🌬️",
            "en": "Windy outdoors — secure hats, scarves & camera straps",
            "te": "గాలి ఎక్కువగా ఉంది — టోపీలు, కెమెరా స్ట్రాప్‌లు జాగ్రత్తగా ఉంచుకోండి",
        })

    if category == "nature":
        suggestions.append({
            "icon": "🦟",
            "en": "Pack mosquito repellent & a small first-aid kit for trails",
            "te": "అటవీ మార్గాల కోసం దోమల నివారిణి & చిన్న ఫస్ట్-ఎయిడ్ కిట్ తీసుకెళ్ళండి",
        })
    elif category in {"heritage", "culture"}:
        suggestions.append({
            "icon": "🧦",
            "en": "Carry socks for warm temple courtyards & modest attire",
            "te": "ఆలయ ప్రాంగణాల కోసం సాక్స్ మరియు సంప్రదాయ దుస్తులు ఉంచుకోండి",
        })

    if len(suggestions) < 2:
        suggestions.append({
            "icon": "💧",
            "en": "Carry a refillable water bottle & comfortable walking shoes",
            "te": "నీటి బాటిల్ మరియు నడకకు అనుకూలమైన చెప్పులు తీసుకెళ్ళండి",
        })
        suggestions.append({
            "icon": "🔋",
            "en": "Keep a charged power bank & offline map downloaded",
            "te": "ఫోన్ పవర్ బ్యాంక్ మరియు ఆఫ్‌లైన్ మ్యాప్ సిద్ధంగా ఉంచుకోండి",
        })

    return suggestions[:4]


def _seasonal_fallback(lat: float, lng: float, best_season: str = "", category: str = "") -> Dict[str, Any]:
    month = datetime.now().month
    is_monsoon = False
    est_num = 26.0
    if month in (11, 12, 1, 2):
        adv_en = "Cool & pleasant winter window across Telangana & Andhra Pradesh."
        adv_te = "తెలంగాణ & ఆంధ్రప్రదేశ్‌లో చల్లని, ఆహ్లాదకరమైన శీతాకాలం."
        est_temp = "21–29°C"
        icon = "🌤️"
        label_en, label_te = "Pleasant Winter Season", "ఆహ్లాదకరమైన శీతాకాలం"
        est_num = 22.0
    elif month in (6, 7, 8, 9):
        adv_en = "Active monsoon period — lush waterfalls & forests, carry rain gear."
        adv_te = "వర్షాకాలం — జలపాతాలు & అడవులు పచ్చగా ఉంటాయి, గొడుగు తీసుకెళ్ళండి."
        est_temp = "24–31°C"
        icon = "🌦️"
        label_en, label_te = "Monsoon Season", "వర్షాకాలం"
        is_monsoon = True
        est_num = 27.0
    elif month == 10:
        adv_en = "Post-monsoon transition — green landscapes and comfortable evenings."
        adv_te = "వర్షాకాలం తర్వాత పచ్చదనం మరియు ఆహ్లాదకరమైన సాయంత్రాలు."
        est_temp = "24–32°C"
        icon = "⛅"
        label_en, label_te = "Post-Monsoon", "వర్షాకాలానంతరం"
        est_num = 27.0
    else:
        adv_en = "Warm summer months — start early mornings (6:30–10 AM) and carry water."
        adv_te = "వేసవి కాలం — ఉదయం 6:30–10 గంటల మధ్య ప్రయాణించండి, నీరు తీసుకెళ్ళండి."
        est_temp = "30–39°C"
        icon = "☀️"
        label_en, label_te = "Warm Summer Season", "వేసవి కాలం"
        est_num = 34.0

    if best_season:
        adv_en = f"{adv_en} Recommended visit window: {best_season}."
        adv_te = f"{adv_te} సందర్శనకు ఉత్తమ సమయం: {best_season}."

    return {
        "available": False,
        "source": "seasonal-fallback",
        "lat": round(lat, 4),
        "lng": round(lng, 4),
        "current": {
            "temperature_c": None,
            "temperature_range": est_temp,
            "apparent_c": None,
            "humidity": None,
            "wind_kmh": None,
            "condition": label_en,
            "condition_te": label_te,
            "icon": icon,
            "advice": adv_en,
            "advice_te": adv_te,
        },
        "suggestions": _build_ai_suggestions(
            weather_code=61 if is_monsoon else 1,
            temp_c=est_num,
            humidity=80 if is_monsoon else 55,
            wind_kmh=12.0,
            max_rain_chance=60 if is_monsoon else 15,
            category=category,
            is_monsoon_season=is_monsoon,
        ),
        "daily": [],
        "updated_at": datetime.now().strftime("%I:%M %p IST"),
    }


async def get_place_weather(lat: float, lng: float, best_season: str = "", category: str = "") -> Dict[str, Any]:
    """Fetch live weather, 3-day forecast, and AI weather suggestions from Open-Meteo."""
    cache_key = (round(float(lat), 2), round(float(lng), 2), category)
    now = time.time()
    cached = _WEATHER_CACHE.get(cache_key)
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": round(float(lat), 4),
        "longitude": round(float(lng), 4),
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "timezone": "Asia/Kolkata",
        "forecast_days": 3,
    }

    try:
        async with httpx.AsyncClient(timeout=6.5) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return _seasonal_fallback(lat, lng, best_season, category)
            raw = resp.json()

        cur = raw.get("current", {})
        daily_raw = raw.get("daily", {})
        w_code = cur.get("weather_code")
        is_day = int(cur.get("is_day", 1) or 1)
        label_en, label_te, icon, adv_en, adv_te = _describe_wmo(w_code, is_day=is_day)

        daily_list: List[Dict[str, Any]] = []
        dates = daily_raw.get("time", []) or []
        d_codes = daily_raw.get("weather_code", []) or []
        t_maxs = daily_raw.get("temperature_2m_max", []) or []
        t_mins = daily_raw.get("temperature_2m_min", []) or []
        p_probs = daily_raw.get("precipitation_probability_max", []) or []

        max_rain = 0
        for idx, date_str in enumerate(dates[:3]):
            dc = d_codes[idx] if idx < len(d_codes) else None
            d_label_en, d_label_te, d_icon, _, _ = _describe_wmo(dc, is_day=1)
            rain_prob = int(p_probs[idx]) if idx < len(p_probs) and p_probs[idx] is not None else 0
            max_rain = max(max_rain, rain_prob)
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                day_label = dt.strftime("%a, %d %b")
                day_label_te = f"{_DAY_NAMES_TE.get(dt.strftime('%a'), dt.strftime('%a'))}, {dt.strftime('%d')}"
            except ValueError:
                day_label = date_str
                day_label_te = date_str
            daily_list.append(
                {
                    "date": date_str,
                    "day_label": "Today" if idx == 0 else day_label,
                    "day_label_te": "ఈరోజు" if idx == 0 else day_label_te,
                    "condition": d_label_en,
                    "condition_te": d_label_te,
                    "icon": d_icon,
                    "temp_max_c": round(t_maxs[idx]) if idx < len(t_maxs) and t_maxs[idx] is not None else None,
                    "temp_min_c": round(t_mins[idx]) if idx < len(t_mins) and t_mins[idx] is not None else None,
                    "rain_chance": rain_prob,
                }
            )

        temp_c = round(cur["temperature_2m"], 1) if cur.get("temperature_2m") is not None else None
        humidity = int(cur["relative_humidity_2m"]) if cur.get("relative_humidity_2m") is not None else None
        wind_kmh = round(cur["wind_speed_10m"], 1) if cur.get("wind_speed_10m") is not None else None

        result: Dict[str, Any] = {
            "available": True,
            "source": "open-meteo",
            "lat": round(float(lat), 4),
            "lng": round(float(lng), 4),
            "current": {
                "temperature_c": temp_c,
                "apparent_c": round(cur["apparent_temperature"], 1) if cur.get("apparent_temperature") is not None else None,
                "humidity": humidity,
                "wind_kmh": wind_kmh,
                "condition": label_en,
                "condition_te": label_te,
                "icon": icon,
                "advice": adv_en,
                "advice_te": adv_te,
            },
            "suggestions": _build_ai_suggestions(
                weather_code=w_code,
                temp_c=temp_c,
                humidity=humidity,
                wind_kmh=wind_kmh,
                max_rain_chance=max_rain,
                category=category,
            ),
            "daily": daily_list,
            "updated_at": datetime.now().strftime("%I:%M %p IST"),
        }
        _WEATHER_CACHE[cache_key] = (now, result)
        return result
    except Exception:
        return _seasonal_fallback(lat, lng, best_season, category)


async def get_batch_gem_weather(gems: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Fetch current, forecast & AI suggestions for every gem concurrently."""
    if not gems:
        return {}

    sem = asyncio.Semaphore(8)

    async def _fetch_one(gem: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        async with sem:
            data = await get_place_weather(
                lat=gem["lat"],
                lng=gem["lng"],
                best_season=gem.get("best_season", ""),
                category=gem.get("category", ""),
            )
            return gem["id"], data

    pairs = await asyncio.gather(*(_fetch_one(g) for g in gems))
    return {gid: data for gid, data in pairs}

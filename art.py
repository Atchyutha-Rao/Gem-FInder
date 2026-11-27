"""Dynamic SVG postcard renderer for Untold Trails gems (no subfolders required)."""

from __future__ import annotations

import html
from typing import Any, Dict

PALETTES = {
    "nature": [
        ("#12372A", "#2C6E58", "#8FC1A9", "#F7E6C4", "#D97736"),
        ("#0F2C3F", "#1E5F74", "#70A9A1", "#F2DFC1", "#E07A5F"),
    ],
    "heritage": [
        ("#4A2511", "#8C3B2B", "#D98A4E", "#F8EBD7", "#F2C14E"),
        ("#2F1E2B", "#6B3340", "#C46D5E", "#F5E4D0", "#E8AA42"),
    ],
    "culture": [
        ("#5E1B24", "#A4383F", "#E28444", "#FAF0DE", "#2E6F5E"),
        ("#223843", "#4E6E58", "#D98A3C", "#FBF5E9", "#B84A39"),
    ],
    "food": [
        ("#6E2614", "#B84A27", "#E69F45", "#FFF4E1", "#2A5C43"),
        ("#4E2A1E", "#9C4221", "#D97736", "#F9EAD3", "#3B7A57"),
    ],
    "village": [
        ("#1B4332", "#40916C", "#95D5B2", "#F7F3E3", "#D97736"),
        ("#264653", "#2A9D8F", "#E9C46A", "#FBF6EC", "#C2593F"),
    ],
}


def _motif_svg(category: str, c1: str, c2: str, c3: str, accent: str, variant: int) -> str:
    if category == "nature":
        if variant == 1:
            return f"""
            <path d="M0 370 Q180 300 390 350 T800 320 L800 520 L0 520 Z" fill="{c2}" opacity="0.75"/>
            <path d="M0 400 Q240 340 500 395 T800 370 L800 520 L0 520 Z" fill="{c1}" opacity="0.92"/>
            <rect x="330" y="255" width="120" height="175" rx="8" fill="#E8F6EF" opacity="0.88"/>
            <path d="M350 255 L350 430 M378 255 L378 430 M406 255 L406 430 M430 255 L430 430" stroke="{c3}" stroke-width="5" stroke-dasharray="18 8"/>
            <ellipse cx="390" cy="435" rx="165" ry="28" fill="#8CD3C5" opacity="0.6"/>
            <ellipse cx="390" cy="438" rx="110" ry="16" fill="#FFFFFF" opacity="0.45"/>
            """
        return f"""
        <path d="M0 360 Q220 260 440 345 T800 300 L800 520 L0 520 Z" fill="{c2}" opacity="0.7"/>
        <path d="M0 415 Q280 385 560 410 T800 395 L800 520 L0 520 Z" fill="{c1}" opacity="0.95"/>
        <path d="M120 430 Q400 395 680 430" stroke="{accent}" stroke-width="6" fill="none" stroke-linecap="round"/>
        <circle cx="240" cy="410" r="14" fill="{c3}" opacity="0.8"/>
        <circle cx="540" cy="405" r="18" fill="{c3}" opacity="0.7"/>
        """
    if category == "heritage":
        if variant == 1:
            return f"""
            <path d="M0 390 Q240 330 480 380 T800 350 L800 520 L0 520 Z" fill="{c2}" opacity="0.65"/>
            <path d="M0 420 L800 420 L800 520 L0 520 Z" fill="{c1}"/>
            <g transform="translate(260, 175)">
              <rect x="35" y="135" width="210" height="110" fill="{c2}" stroke="{accent}" stroke-width="2"/>
              <polygon points="55,135 225,135 200,90 80,90" fill="{c3}"/>
              <polygon points="85,90 195,90 170,50 110,50" fill="{c2}"/>
              <polygon points="118,50 162,50 140,12" fill="{accent}"/>
              <rect x="118" y="175" width="44" height="70" rx="22" fill="{c1}"/>
              <rect x="65" y="160" width="22" height="85" fill="{c3}" opacity="0.75"/>
              <rect x="193" y="160" width="22" height="85" fill="{c3}" opacity="0.75"/>
            </g>
            """
        return f"""
        <path d="M0 375 L180 285 L340 345 L530 265 L800 375 L800 520 L0 520 Z" fill="{c2}" opacity="0.78"/>
        <rect x="195" y="295" width="410" height="55" fill="{c1}"/>
        <path d="M210 295 v-18 h28 v18 h28 v-18 h28 v18 h28 v-18 h28 v18 h28 v-18 h28 v18 h28 v-18 h28 v18 h28 v-18 h28 v18" fill="none" stroke="{accent}" stroke-width="5"/>
        <path d="M0 425 L800 425 L800 520 L0 520 Z" fill="{c1}"/>
        """
    if category == "culture":
        return f"""
        <path d="M0 400 L800 400 L800 520 L0 520 Z" fill="{c1}" opacity="0.92"/>
        <g transform="translate(140,145)" opacity="0.92">
          <rect x="20" y="30" width="480" height="210" rx="14" fill="{c2}" stroke="{accent}" stroke-width="3"/>
          <path d="M60 65 L120 135 L60 205 L120 135 L180 65 L240 135 L180 205 M240 135 L300 65 L360 135 L300 205 M360 135 L420 65 L480 135 L420 205" stroke="#FAF0DE" stroke-width="6" fill="none"/>
          <circle cx="150" cy="135" r="14" fill="{accent}"/>
          <circle cx="270" cy="135" r="14" fill="{accent}"/>
          <circle cx="390" cy="135" r="14" fill="{accent}"/>
        </g>
        """
    if category == "food":
        return f"""
        <path d="M0 390 L800 390 L800 520 L0 520 Z" fill="{c1}" opacity="0.95"/>
        <ellipse cx="400" cy="340" rx="185" ry="62" fill="{c3}"/>
        <ellipse cx="400" cy="332" rx="158" ry="48" fill="#FFF4E1"/>
        <ellipse cx="400" cy="330" rx="125" ry="34" fill="{accent}" opacity="0.9"/>
        <circle cx="360" cy="328" r="7" fill="#5E1B24"/>
        <circle cx="400" cy="320" r="7" fill="#5E1B24"/>
        <circle cx="440" cy="332" r="7" fill="#5E1B24"/>
        <path d="M350 245 Q365 215 350 190 M400 235 Q415 205 400 175 M450 245 Q465 215 450 190" stroke="#FFF4E1" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>
        """
    return f"""
    <path d="M0 375 Q200 335 420 370 T800 355 L800 520 L0 520 Z" fill="{c2}" opacity="0.8"/>
    <path d="M0 415 L800 415 L800 520 L0 520 Z" fill="{c1}"/>
    <g transform="translate(185, 240)">
      <polygon points="0,85 95,15 190,85" fill="{accent}"/>
      <rect x="22" y="85" width="146" height="90" fill="#F7F3E3"/>
      <rect x="75" y="115" width="40" height="60" rx="4" fill="{c1}"/>
    </g>
    <path d="M560 415 Q565 290 540 215" stroke="{c1}" stroke-width="10" fill="none"/>
    <path d="M540 215 Q495 190 465 225 M540 215 Q585 185 620 220 M540 215 Q540 165 570 175 M540 215 Q510 170 485 185" stroke="{c2}" stroke-width="8" fill="none" stroke-linecap="round"/>
    """


def render_gem_svg(gem: Dict[str, Any], variant: int = 1) -> str:
    """Return a crisp 800x520 SVG postcard string for a gem."""
    cat = gem.get("category", "nature")
    idx = 0 if variant != 2 else 1
    c1, c2, c3, sky, accent = PALETTES.get(cat, PALETTES["nature"])[idx]
    name = html.escape(str(gem.get("name", "Untold Gem")))
    region = html.escape(str(gem.get("region", "Telangana & Andhra Pradesh")))
    lat = float(gem.get("lat", 17.5))
    lng = float(gem.get("lng", 79.5))
    coords = f"{lat:.4f}° N, {lng:.4f}° E"
    cat_label = html.escape(cat.upper())
    sun_x = 640 if variant == 1 else 160
    sun_y = 125 if variant == 1 else 135
    subtitle = "DISCOVER THE UNSEEN" if variant == 1 else "LOCAL IMPACT & HERITAGE TRAIL"

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="800" height="520">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{sky}"/>
      <stop offset="100%" stop-color="{c3}" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  <rect width="800" height="520" fill="url(#bg)"/>
  <circle cx="{sun_x}" cy="{sun_y}" r="54" fill="{accent}" opacity="0.88"/>
  <circle cx="{sun_x}" cy="{sun_y}" r="74" fill="{accent}" opacity="0.22"/>
  <path d="M50 90 Q110 70 170 90 M620 220 Q690 198 755 220" stroke="{c2}" stroke-width="2" fill="none" opacity="0.28"/>
  {_motif_svg(cat, c1, c2, c3, accent, variant)}
  <rect x="24" y="24" width="752" height="472" rx="18" fill="none" stroke="{c1}" stroke-width="2" opacity="0.25"/>
  <rect x="42" y="42" width="136" height="32" rx="16" fill="{c1}" opacity="0.9"/>
  <text x="110" y="63" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#FAF5EC" text-anchor="middle" letter-spacing="1.5">{cat_label}</text>
  <text x="42" y="458" font-family="Georgia, serif" font-size="28" font-weight="700" fill="#FAF5EC">{name}</text>
  <text x="42" y="484" font-family="system-ui, sans-serif" font-size="14" fill="#F2E4D0" opacity="0.92">{region}  •  {coords}  •  {subtitle}</text>
</svg>
"""


def render_stay_svg(stay: Dict[str, Any]) -> str:
    """Return an 800x520 SVG postcard for a verified local stay."""
    c1, c2, c3, sky, accent = PALETTES["village"][0]
    name = html.escape(str(stay.get("name", "Verified Stay")))
    region = html.escape(str(stay.get("region", "Telangana & Andhra Pradesh")))
    price = int(stay.get("price_per_night", 1200))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="800" height="520">
  <defs>
    <linearGradient id="staybg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{sky}"/>
      <stop offset="100%" stop-color="{c3}" stop-opacity="0.5"/>
    </linearGradient>
  </defs>
  <rect width="800" height="520" fill="url(#staybg)"/>
  <circle cx="650" cy="120" r="50" fill="{accent}" opacity="0.86"/>
  {_motif_svg("village", c1, c2, c3, accent, 1)}
  <rect x="42" y="42" width="166" height="32" rx="16" fill="{c1}" opacity="0.92"/>
  <text x="125" y="63" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#FAF5EC" text-anchor="middle" letter-spacing="1.2">VERIFIED STAY</text>
  <text x="42" y="458" font-family="Georgia, serif" font-size="27" font-weight="700" fill="#FAF5EC">{name}</text>
  <text x="42" y="484" font-family="system-ui, sans-serif" font-size="14" fill="#F2E4D0" opacity="0.92">{region}  •  INR {price}/night  •  Direct Local Host</text>
</svg>
"""

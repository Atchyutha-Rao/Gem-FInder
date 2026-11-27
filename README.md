# Untold Trails

> **Discover the Unseen. Support the Local.**
> A community-powered discovery platform and grounded AI trip planner for lesser-known places, regional food, crafts, and rural culture across **Telangana** and **Andhra Pradesh**.

Built for **AVISHKAAR Season 4 (27–28 Nov 2026)** — Problem Statement: *Improving Visibility of Lesser-Known Tourist Places, Food, and Culture*.

---

## Problem & Solution

- **The Problem:** Over-tourism crowds a handful of famous landmarks while hundreds of authentic waterfalls, village temples, handloom clusters, and heirloom food kitchens remain invisible online—causing local communities to miss sustainable tourism income.
- **Our Solution (Four Pillars):**
  1. **Discover:** Interactive Leaflet + OpenStreetMap explorer with sticky filters for category, region, season, and budget.
  2. **Plan:** Grounded AI Trip Planner that builds multi-day itineraries **exclusively from verified database entries** (zero hallucinated locations).
  3. **Contribute:** Community submission form with map-pin picker & photo upload; submissions enter a `pending` queue until reviewed in `/admin`.
  4. **Support Local:** Every gem showcases local guides, artisan cooperatives, home-stays, and family kitchens—plus English & Telugu (`తెలుగు`) story toggles.

## Architecture & Flat Project Files

All application files live directly inside `Tourist Places`:

- `main.py` — FastAPI server (REST API `/api/*`, SVG artwork route `/img/*`, uploaded photos `/uploads/*`, and SPA frontend)
- `planner.py` — Grounded AI Trip Planner with strict verified-ID validation + geographic clustering fallback
- `art.py` — Dynamic SVG travel postcard renderer for every gem
- `gems.json` — Verified Telangana & Andhra Pradesh hidden gems database (with Telugu translations)
- `index.html`, `styles.css`, `app.js`, `pages.js`, `components.js`, `api.js`, `store.js` — Frontend SPA
- `requirements.txt`, `.env.example`, `.gitignore`, `SPEC.md`, `README.md`

## Quick Start (Local)

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Configure environment (optional for LLM API):**
   ```bash
   cp .env.example .env
   # Optionally add GEMINI_API_KEY=... inside .env
   ```
3. **Start the application:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. **Open in browser:**
   Visit [http://localhost:8000](http://localhost:8000)

## Data Sources & Credits
- All seed locations, coordinates, and historical summaries were verified against public tourism references, GI tag registries, and Wikipedia records for Telangana and Andhra Pradesh.
- Local support contacts marked `(Sample Demo)` are illustrative placeholders for hackathon demonstration; always check local timings before travelling.

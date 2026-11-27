# Untold Trails — Technical Specification

> Reference specification derived from [Untold_Trails_Project_Plan.md](./Untold_Trails_Project_Plan.md).

## Overview
**Untold Trails** is a community-powered discovery and ethical trip-planning platform for lesser-known tourist places, regional food, crafts, and rural culture in **Telangana** and **Andhra Pradesh**.

## Core Pillars
1. **Discover**: Interactive Leaflet + OpenStreetMap explorer with sticky filters (category, region, budget, season, search).
2. **Plan**: Grounded AI Trip Planner (`POST /api/plan`) that plans itineraries **strictly** from verified database entries (no hallucinated places).
3. **Contribute**: Community submission flow with photo upload and interactive map pin (`POST /api/gems` -> `pending` status) + Admin approval queue (`/admin`).
4. **Support Local**: Every entry highlights local guides, artisan cooperatives, home-stays, and village kitchens so tourism revenue reaches communities directly.

## Data Model (`gems.json`)
- `id`, `name`, `category` (`heritage | nature | food | culture | village`), `region`, `state`, `lat`, `lng`
- `summary`, `story`, `story_te` (Telugu translation), `best_season`, `how_to_reach`, `budget_per_day`, `duration_hours`
- `images` (list of image URLs), `image_credit`, `local_support` (`type`, `name`, `contact`, `note`)
- `tags`, `status` (`verified | pending | rejected`), `source` (`seed | community`), `submitted_by`

## API Endpoints
- `GET /api/gems?category=&region=&q=&max_budget=&season=` — List & filter verified gems
- `GET /api/gems/{id}` — Full gem details + nearby gems
- `POST /api/gems` — Submit a new gem (multipart form with optional photo upload, saved as `pending`)
- `GET /api/admin/pending` — List pending submissions + analytics summary
- `POST /api/admin/approve/{id}` — Approve submission (sets `verified`)
- `POST /api/admin/reject/{id}` — Reject submission
- `POST /api/plan` — Generate grounded multi-day itinerary with strict ID validation
- `GET /api/health` — Service health & planner mode status

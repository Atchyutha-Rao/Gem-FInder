# Untold Trails: Full Project Plan

**Hackathon:** AVISHKAAR Season 4 (Virtual), 27-28 Nov 2026
**Problem statement:** Improving Visibility of Lesser-Known Tourist Places, Food, and Culture
**Team:** Solo, built with Antigravity in VS Code
**Default region:** Telangana and Andhra Pradesh (change it if you prefer another)

---

## 1. One-line pitch

Untold Trails is a community-powered discovery platform that puts hidden temples, villages, street-food spots, crafts, and festivals on the map, plans trips around them with AI, and sends tourist money to the local people who deserve it.

## 2. The problem

- A small number of famous destinations get most tourists, so they are crowded and overpriced.
- Hundreds of lesser-known places, local dishes, and cultural traditions stay invisible online. Information is scattered, outdated, or only in the local language.
- Local communities (home-stays, guides, artisans, small food vendors) lose income they could earn.
- Travellers who want authentic experiences have no trusted single place to find them.

## 3. The solution

A web app with four pillars:

| Pillar | What it does |
|---|---|
| **Discover** | Interactive map and cards for hidden places, food, and cultural experiences, with filters |
| **Plan** | AI trip planner that builds an itinerary only from verified entries in the database |
| **Contribute** | Locals and travellers submit new gems; entries go through a simple review before appearing as "Verified" |
| **Support local** | Each entry shows local contacts or experiences (guides, home-stays, food stalls), so money reaches the community |

**What makes it different from a generic travel app**
1. Only lesser-known places are in scope.
2. The planner cannot invent places; it uses the database only (no hallucinated locations).
3. Community submissions with a verification badge.
4. A "Local Impact" focus: every gem shows who benefits.
5. Telugu and English support, so it works for local contributors too.

## 4. Target users

- **Travellers** looking for offbeat, authentic trips (students, families, weekend travellers).
- **Local contributors** such as villagers, food vendors, guides, and artisans.
- **Tourism boards and NGOs** who want to promote local areas.

## 5. Features

### Must have (the demo depends on these)
1. **Home page** with a hero section, search, category chips, and a featured gems carousel.
2. **Explore page** with an interactive map (Leaflet + OpenStreetMap) and a card list. Filters: category, district or region, budget, best season.
3. **Gem detail page** with a photo gallery, story, how to reach, best time to visit, rough budget, nearby gems, and local support options.
4. **AI trip planner**: user enters days, interests, starting city, and budget; gets a day-by-day itinerary with map markers.
5. **Submit a gem** form with photo upload, location pin, category, and story. The entry is saved as "Pending" and an admin page approves it.

### Should have (if time allows)
6. Telugu translation toggle for gem stories (pre-translated for the seed data).
7. "Save to my trip" list (stored in the browser).
8. Shareable gem card image for WhatsApp and Instagram.
9. Simple analytics on the admin page (gems per category, submissions).

### Future scope (mention in the pitch only)
- Audio stories, offline mode, user accounts and reviews, partnerships with tourism boards, a booking and payment layer for home-stays and guides, a festival calendar.

## 6. Categories

| Category | Examples of what to list |
|---|---|
| Heritage and temples | Lesser-known temples, forts, stepwells, caves |
| Nature | Waterfalls, lakes, viewpoints, forests |
| Food | Local dishes, street-food stalls, village kitchens |
| Culture and crafts | Handloom and handicraft villages, folk art, festivals |
| Villages and stays | Rural home-stays, farm experiences |

## 7. User flows

**Traveller:** Home, Explore (filter or search), Gem detail, "Add to trip" or "Plan my trip", Itinerary view.

**Contributor:** Submit a gem, enter details and pin the location, upload photos, Pending state, admin approves, Verified gem appears on the map.

**Admin (demo only):** Open `/admin`, see pending submissions, approve or reject.

## 8. Architecture

```
React (Vite) frontend
   |  - Leaflet map
   |  - Pages: Home, Explore, Gem, Planner, Submit, Admin
   v
Backend API (FastAPI or Node/Express)
   |  - /api/gems        read and filter
   |  - /api/gems (POST) submit
   |  - /api/admin       approve / reject
   |  - /api/plan        calls the LLM
   v
Storage: SQLite (or JSON file for the first version)
   +  Image folder (or Cloudinary / Supabase storage)
   +  LLM API (server-side key)
```

Keep the first version simple: gems in `gems.json` plus a tiny backend for the planner and submissions. Move to SQLite only if time allows.

## 9. Data model

```json
{
  "id": "gem_001",
  "name": "Place or experience name",
  "category": "nature | heritage | food | culture | village",
  "region": "District, State",
  "lat": 0.0,
  "lng": 0.0,
  "summary": "One-line hook",
  "story": "2 to 4 sentences with history or local context",
  "story_te": "Telugu version (optional)",
  "best_season": "Oct-Feb",
  "how_to_reach": "Nearest town, distance, transport tip",
  "budget_per_day": 800,
  "duration_hours": 3,
  "images": ["/img/gem_001_1.jpg"],
  "local_support": [
    { "type": "guide | stay | food | craft", "name": "Local name", "contact": "optional" }
  ],
  "tags": ["offbeat", "family", "photography"],
  "status": "verified | pending",
  "source": "seed | community",
  "submitted_by": "optional"
}
```

## 10. API design

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/gems?category=&region=&q=` | List and filter verified gems |
| GET | `/api/gems/:id` | Gem details |
| POST | `/api/gems` | Submit a new gem (status = pending) |
| GET | `/api/admin/pending` | List pending submissions |
| POST | `/api/admin/approve/:id` | Approve (set verified) |
| POST | `/api/admin/reject/:id` | Reject |
| POST | `/api/plan` | Generate itinerary |

## 11. AI trip planner design

**Principle:** the model may only choose from the gems you pass in. This prevents invented places.

**Flow**
1. User inputs: days, interests, start city, budget, travel style.
2. Backend filters the gem list (by region and interests), keeps the top 15 to 20.
3. Backend sends that list plus the user input to the LLM.
4. LLM returns strict JSON: days, each with ordered gem IDs, a short reason, and travel notes.
5. Backend validates that every returned ID exists, then the frontend renders the itinerary and map route.

**System prompt (starting point)**
```
You are a travel planner for lesser-known places.
Use ONLY the places provided in the list below. Do not add any place that is not in the list.
Plan a trip of {days} days for a traveller who likes {interests}, starting from {city},
with a budget of about {budget} per day.
Group nearby places on the same day and keep each day realistic (at most 3 places).
Return ONLY valid JSON in this format:
{ "days": [ { "day": 1, "gem_ids": ["..."], "why": "...", "tip": "..." } ] }
Places: {gems_json}
```

**Safety and quality**
- Keep the API key on the server, never in the frontend or the public repo.
- Validate the JSON and retry once if it is malformed.
- Show a "Check timings before travelling" note, since the data is sample data.

## 12. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind | Fast to build, easy for the AI agent to generate |
| Map | Leaflet + OpenStreetMap | Free, no API key |
| Backend | FastAPI (Python) or Express (Node) | Small and simple |
| Storage | JSON file, then SQLite | Zero setup |
| AI | Any LLM API (Gemini, Claude, or OpenAI) | Planner and optional translation |
| Hosting | Netlify or Vercel (frontend), Render (backend) | Free tiers, gives a live link for the deck |

## 13. Suggested folder structure

```
untold-trails/
  README.md
  SPEC.md
  .env.example
  .gitignore            (must include .env)
  frontend/
    src/
      pages/ (Home, Explore, GemDetail, Planner, Submit, Admin)
      components/ (Map, GemCard, FilterBar, Itinerary)
      data/gems.json
  backend/
    main.py
    planner.py
    data/gems.json
    uploads/
  docs/
    screenshots/
    architecture.png
```

## 14. Seed data guide (the most important part)

An empty or fake-looking app loses points. Prepare **15 to 20 real entries** from one region before you start coding the UI.

**Per entry, collect**
- 2 or 3 real photos (use your own, or openly licensed ones such as Wikimedia Commons, and credit the source)
- Accurate coordinates (from OpenStreetMap or Google Maps)
- A short, true story from reliable sources such as tourism department pages, Wikipedia, and local news
- Travel details (nearest town, distance, season)

**Candidate places to research (verify each one before using it, and check whether it is genuinely lesser-known)**
- Telangana: waterfalls and lakes in the Mulugu, Adilabad, and Khammam areas; village temples and forts around Warangal, Bhongir, and Medak; handloom villages such as Pochampally and Gadwal weaving clusters.
- Andhra Pradesh: caves and temples in Kurnool and Anantapur districts; coastal villages in Konaseema; hill and forest areas of the Eastern Ghats; handicraft villages such as Kondapalli and Etikoppaka.
- Food: regional dishes and small local eateries in each district, with the dish name, ingredients, and where it is served.

Do not include places you cannot verify. Fewer accurate entries beat many shaky ones.

## 15. UI and design notes

- Warm, earthy palette (terracotta, deep green, cream) to feel local and authentic.
- Large photo cards, a clean map, and a sticky filter bar.
- Mobile-first layout, because most evaluators and real users will use phones.
- A visible **Verified** badge and a **Local Impact** badge on each gem.

## 16. Build plan for working solo with Antigravity

**Before the first prompt:** save this file as `SPEC.md` in an empty repo and give it to the agent first.

| Phase | Target | Output |
|---|---|---|
| 1. Setup (1 h) | Public repo, stack decided, app runs | Hello-world frontend and backend |
| 2. Data (1.5 h) | 15 to 20 gems in `gems.json` | Real data and photos |
| 3. Core UI (5 h) | Home, Explore with map and filters, Gem page | Working discovery flow |
| 4. Planner (2.5 h) | `/api/plan` and the planner page | Itinerary from real data |
| 5. Submit and admin (1.5 h) | Form, pending state, approve page | Community flow |
| 6. Polish (1 h) | Mobile layout, loading and error states | Demo-ready app |
| Sleep (5 h or more) | Rest | |
| 7. Test and deploy (1.5 h) | Test all flows, deploy | Live link |
| 8. Deck and README (1.5 h) | Template filled, screenshots added | Submission ready |
| 9. Submit (by 10:30 AM) | Check public links | Done early |

**Prompting rules**
- One small task per prompt, and test before the next.
- Commit after each working step.
- Review the code it writes so you can answer questions about it.
- Do not accept large rewrites late in the build.
- Stop adding features about 6 hours before the deadline.

**Example first prompts**
1. "Read SPEC.md. Create the folder structure and a Vite React frontend with a Leaflet map showing markers from `data/gems.json`."
2. "Add a filter bar for category and region that filters the markers and the card list."
3. "Build the gem detail page from the data model in SPEC.md."
4. "Add a FastAPI endpoint `/api/plan` that follows section 11 and validates the returned IDs."

## 17. Submission checklist

- [ ] Problem statement locked on the portal: https://ems.aitamsac.in/events/2
- [ ] Public GitHub repo with code, README, and `.env.example` (no secrets committed)
- [ ] Google Drive folder with screenshots, demo video, and extra files, set to public
- [ ] Drive link written inside the presentation deck
- [ ] Deck completed in the provided template
- [ ] Live demo link tested on a phone
- [ ] Backup demo video recorded
- [ ] Links opened in a private browser window to confirm public access
- [ ] Submitted between 8:00 and 11:30 AM on 28 Nov (aim for before 10:30)

## 18. Presentation deck outline

1. Title and tagline
2. The problem (with one striking fact or example)
3. Who it affects (travellers and local communities)
4. Our solution (four pillars)
5. How it works (user flow screenshots)
6. Architecture and tech stack
7. AI planner: how it avoids made-up places
8. Live demo or demo screenshots
9. Impact (income for locals, spread of tourism, culture preservation)
10. Scalability and future scope
11. Links: GitHub, live demo, Drive

## 19. Five-minute pitch script (structure)

| Time | Content |
|---|---|
| 0:00 to 0:40 | Problem: crowded famous places, invisible hidden ones, locals losing income |
| 0:40 to 1:10 | Solution in one sentence, then the four pillars |
| 1:10 to 3:30 | Live demo: map and filter, open a gem, run the planner, submit a gem and approve it |
| 3:30 to 4:15 | Impact and why the planner is trustworthy |
| 4:15 to 5:00 | Future scope and closing line |

## 20. Likely evaluator questions and answers to prepare

| Question | Answer direction |
|---|---|
| How do you stop fake or wrong submissions? | Pending state, admin review, verified badge, and future community upvotes |
| How is this different from Google Maps or TripAdvisor? | Curated for lesser-known places, community-driven, planner limited to verified data, and focused on local income |
| How does AI avoid inventing places? | It only receives and may only return IDs from the database, and the backend validates them |
| How will locals benefit financially? | Local support section on each gem, with future bookings for stays, guides, and food |
| How will it scale? | Move to a managed database, add district-level partners, and add more languages |
| What data do you have right now? | Be honest: a seeded set of real entries from one region, plus the community submission flow |
| What did you build yourself vs with AI tools? | Be honest and be ready to explain the architecture and key code |

## 21. Risks and how to handle them

| Risk | Mitigation |
|---|---|
| Too little real data | Do the data phase early and limit it to one region |
| Planner returns bad JSON | Strict prompt, validation, one retry, and a fallback message |
| Time lost on UI polish | Use Tailwind with a few reusable components, and stop polishing 6 hours before the deadline |
| Deployment problems | Deploy a basic version early (around hour 8) and update it |
| API key leak | `.env`, `.gitignore`, and check the repo before making it public |
| Fatigue | Sleep at least 5 hours and avoid late risky changes |
| Looks like a generic travel app | Lead the demo with the community submission, the Verified badge, and the Local Impact angle |

## 22. README outline (write as you build)

1. Project name, tagline, and screenshot
2. Problem and solution
3. Features
4. Tech stack
5. Architecture diagram
6. Setup instructions (clone, install, add `.env`, run)
7. How the AI planner works
8. Data sources and credits
9. Future scope
10. Author

---

*Notes: All place data must be verified from reliable sources before it goes into the app. Credit image sources, and label any sample data clearly in the demo.*

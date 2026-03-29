# 🍱 FoodBridge
### Real-Time Surplus Food Redistribution Platform

> **Vashisht Hackathon 3.0 — EcoTech Track**  
> Rescue Food. Feed Communities. Reduce Waste.

---

## 🌍 The Problem

India wastes **67 million tonnes of food** every year — while over **200 million people** go hungry. Surplus food from restaurants, households, and events goes to landfills not because there is no need, but because **there is no real-time system to connect donors with receivers nearby**.

FoodBridge solves this with a live, map-based platform where food finds a home in minutes — not days.

---

## ✨ What We Built

FoodBridge is a **Progressive Web App (PWA)** with three user roles — Donor, Receiver, and Volunteer — each with a tailored experience.

### 🗺️ Live Map with Real-Time Pins
Browse all available food listings on an interactive map. Pins are **color-coded by urgency**:
- 🔴 **Red** — Expiring in under 2 hours (Urgent)
- 🟠 **Orange** — Expiring in under 6 hours
- 🔵 **Blue** — Available today
- 🟢 **Green** — Fresh, plenty of time

New listings appear on the map **live without page refresh** — powered by Supabase Realtime WebSockets.

### 📦 Post Food (Donors)
Donors fill out a simple form with food name, quantity, food type, expiry time, photo, and pickup address. The address is **auto-geocoded** to map coordinates using the Nominatim API (no API key required).

### 🤖 AI Food Safety Analysis
When a donor uploads a photo, it is **instantly analyzed by an AI vision model** (via OpenRouter) which checks the food's freshness and safety — giving receivers confidence before they claim.

### ✅ Claim Food (Receivers)
Receivers browse the live map, click a pin, see full details, and claim food in one tap. A **WhatsApp deep link** is generated instantly with the donor's number — no in-app chat needed, coordination happens naturally.

### 🚗 Volunteer Pickups
A dedicated Volunteer role can browse all available listings sorted by urgency and **accept delivery assignments** — enabling third-party logistics for situations where donors and receivers can't meet directly.

### 📊 Impact Dashboard
Every user gets a personalized dashboard showing:
- Animated count-up stats (kg saved, meals served, CO₂ avoided)
- **Gamification** — points, levels (Newcomer → Legend), and achievement badges (🌱 First Post, 🥇 Gold Donor, 🌍 Food Champion)
- Donor listing history (Active / Claimed / Expired tabs)
- Receiver claim history with donor contact info

### ⭐ Rating System
After a successful food exchange, receivers can **rate donors** with a star rating and comment — building trust and accountability in the community over time.

### 📋 Transparency Report
A public page showing the **complete open record** of all food redistributed through FoodBridge — total transactions, kg saved, unique donors, with a live-updating feed. Anyone can verify the platform's real-world impact without logging in.

### 👤 User Profiles
Users manage their name, phone number, organisation, and address. Profile page also displays earned badges, points, level, and average rating received.

### 📲 Progressive Web App (PWA)
FoodBridge is fully installable on any device — tap **Add to Home Screen** on mobile and it works like a native app with offline support via service worker.

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 + Vite 8 | Fast dev, hot reload, modern React |
| Styling | Tailwind CSS 4 | Mobile-first utility classes |
| Database | Supabase (PostgreSQL) | Free tier, instant setup, RLS built in |
| Auth | Supabase Auth | Email/password, session handling |
| Realtime | Supabase Realtime | Live map pin updates via WebSocket |
| Storage | Supabase Storage | Food photo uploads with public CDN |
| Maps | Leaflet.js + react-leaflet | Free, no API key, OpenStreetMap tiles |
| Geocoding | Nominatim API | Address → lat/lng, completely free |
| AI Analysis | OpenRouter API | Vision model for food safety checks |
| Server | Express.js | Serves static build + AI proxy endpoint |
| PWA | vite-plugin-pwa | Service worker + installable manifest |
| Notifications | react-hot-toast | Clean toast alerts |

---

## 🚀 Getting Started (Local Setup)

### Prerequisites
- Node.js 18+
- A Supabase project (free at [supabase.com](https://supabase.com))
- An OpenRouter API key (free at [openrouter.ai/keys](https://openrouter.ai/keys))

### 1. Clone the repository
```bash
git clone https://github.com/ankitnegi-dev/foodbridge.git
cd foodbridge
```

### 2. Install dependencies
```bash
npm install --legacy-peer-deps
```

### 3. Set up environment variables
```bash
cp .env.example .env
```
Fill in your `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

### 4. Set up the Supabase database
Go to your Supabase project → **SQL Editor** → run the following:

```sql
-- profiles
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text check (role in ('donor', 'receiver', 'volunteer')),
  name text, org_name text, phone text, address text,
  avatar_url text, created_at timestamptz default now()
);

-- food_listings
create table if not exists food_listings (
  id uuid default gen_random_uuid() primary key,
  donor_id uuid references profiles(id) on delete cascade,
  food_name text not null, description text,
  quantity numeric, unit text default 'kg',
  food_type text[], expiry_at timestamptz not null,
  photo_url text, pickup_address text,
  lat numeric, lng numeric,
  status text default 'available',
  created_at timestamptz default now()
);

-- claims
create table if not exists claims (
  id uuid default gen_random_uuid() primary key,
  listing_id uuid references food_listings(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  status text default 'pending',
  created_at timestamptz default now()
);

-- ratings
create table if not exists ratings (
  id uuid default gen_random_uuid() primary key,
  rater_id uuid references profiles(id),
  ratee_id uuid references profiles(id),
  listing_id uuid references food_listings(id),
  claim_id uuid references claims(id),
  rating integer check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(rater_id, listing_id)
);

-- Enable RLS
alter table profiles enable row level security;
alter table food_listings enable row level security;
alter table claims enable row level security;
alter table ratings enable row level security;

-- Policies
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

create policy "Anyone logged in can view listings" on food_listings for select using (auth.uid() is not null);
create policy "Donors can insert listings" on food_listings for insert with check (auth.uid() = donor_id);
create policy "Donors can update listings" on food_listings for update using (auth.uid() = donor_id);

create policy "Receivers can insert claims" on claims for insert with check (auth.uid() = receiver_id);
create policy "Users can view own claims" on claims for select using (auth.uid() = receiver_id or auth.uid() = (select donor_id from food_listings where id = listing_id));

create policy "Anyone can read ratings" on ratings for select using (true);
create policy "Users can insert ratings" on ratings for insert with check (auth.uid() = rater_id);

-- Enable Realtime
alter publication supabase_realtime add table food_listings;
alter publication supabase_realtime add table claims;
```

Also go to **Storage → New Bucket** → name it `food-photos` → set to **Public**.

### 5. Run in development mode
```bash
npm run dev
```
App runs at **http://localhost:5173**

### 6. Run in production mode
```bash
npm run build
OPENROUTER_API_KEY=your_key npm run serve
```
App runs at **http://localhost:3001**

---

## 📁 Project Structure

```
foodbridge/
├── src/
│   ├── pages/
│   │   ├── Landing.jsx         # Public landing page with impact stats
│   │   ├── Login.jsx           # Email/password auth
│   │   ├── Register.jsx        # New account creation
│   │   ├── Onboarding.jsx      # Role selection (Donor / Receiver)
│   │   ├── Dashboard.jsx       # Impact stats, badges, gamification
│   │   ├── MapPage.jsx         # Live Leaflet map with realtime pins
│   │   ├── PostFood.jsx        # Donor: post food + AI photo analysis
│   │   ├── MyListings.jsx      # Donor: Active / Claimed / Expired tabs
│   │   ├── Claims.jsx          # Receiver: claim history + ratings
│   │   ├── VolunteerPage.jsx   # Volunteer: accept delivery assignments
│   │   ├── Profile.jsx         # User profile + badges + ratings
│   │   └── Transparency.jsx    # Public: open record of all exchanges
│   ├── components/
│   │   ├── Navbar.jsx          # Role-aware top navigation
│   │   ├── ListingCard.jsx     # Reusable food listing card
│   │   └── RatingModal.jsx     # Star rating + comment modal
│   ├── context/
│   │   └── AuthContext.jsx     # Supabase auth state + profile
│   ├── lib/
│   │   └── supabase.js         # Supabase client initialisation
│   └── App.jsx                 # Routes, protected routes, mobile nav
├── server.js                   # Express server + OpenRouter AI proxy
├── .env.example                # Environment variable template
└── index.html
```

---

## 🔑 Environment Variables

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) — free tier available |

---

## 📦 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server at localhost:5173 |
| `npm run build` | Build optimised production bundle |
| `npm run serve` | Start Express production server at localhost:3001 |
| `npm run lint` | Run ESLint |

---

## 🌐 Live Demo

🔗 **[foodbridge.vercel.app](https://foodbridge-seven.vercel.app/)

---

🌐 Live Demo
🔗 FoodBridge Web App

📱 Mobile App (Android)
FoodBridge is available as an installable Android app (generated from the PWA):
FileDescriptionFoodBridge.apkInstall directly on any Android deviceFoodBridge.aabAndroid App Bundle (for Play Store submission)
How to install the APK on Android:

Download FoodBridge.apk from this repo
On your Android device, go to Settings → Security → Allow unknown sources
Open the downloaded APK and tap Install
Launch FoodBridge from your home screen


Alternatively, the web app is fully installable as a PWA — visit the live link on mobile and tap Add to Home Screen.

## 📽️ Demo Video

Watch the 3-5 minute demo: `demo.mp4` 
## 📽️ Demo Video
https://github.com/user-attachments/assets/8751e92d-845e-487c-aa5a-758e9726a9b7



The demo covers:
1. Registering as a Donor and posting a food listing with AI photo analysis
2. The listing appearing as a live map pin in real time on a second browser tab
3. Claiming the food as a Receiver and generating the WhatsApp contact link
4. The impact dashboard updating with animated stats

---

## 🏆 Judging Criteria Coverage

| Criterion | Weight | How FoodBridge addresses it |
|---|---|---|
| Technical Implementation | 35% | Supabase Realtime WebSockets, AI vision API, haversine distance filtering, RLS policies, PWA service worker |
| Innovation | 20% | AI food safety analysis, volunteer logistics role, public transparency report, gamification with levels and badges |
| Feasibility | 20% | Fully deployed, works on any device, uses free-tier APIs, WhatsApp integration removes friction |
| Video Presentation | 15% | Live two-tab realtime demo, local Chennai seed data, animated impact stats |
| Deployment | 10% | Hosted on Vercel with public URL, installable as PWA on mobile |

---

## 👥 Team

Built during **Vashisht Hackathon 3.0** at IIITDM Kancheepuram (March 28–29, 2026).

1.ANKIT NEGI
2.PRINCE KUMAR

---

## 📜 Open Source Libraries Used

- [React](https://react.dev/) — MIT License
- [Vite](https://vitejs.dev/) — MIT License
- [Tailwind CSS](https://tailwindcss.com/) — MIT License
- [Supabase JS](https://github.com/supabase/supabase-js) — MIT License
- [Leaflet](https://leafletjs.com/) — BSD 2-Clause License
- [react-leaflet](https://react-leaflet.js.org/) — Hippocratic License
- [react-router-dom](https://reactrouter.com/) — MIT License
- [react-hot-toast](https://react-hot-toast.com/) — MIT License
- [Express](https://expressjs.com/) — MIT License
- [OpenStreetMap / Nominatim](https://nominatim.org/) — ODbL License
- [OpenRouter](https://openrouter.ai/) — API service

---

*FoodBridge — because every meal matters.*

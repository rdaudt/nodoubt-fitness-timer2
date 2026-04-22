# HIIT Timer — Product Requirements Document
> Status: **Draft v0.3** — Brand context and marketing screens added

---

## 1. Product Overview

A mobile-optimized Progressive Web App (PWA) that allows users to create, manage, and run fully customizable HIIT (High-Intensity Interval Training) timers. The app is free to use and serves as a marketing vehicle for **NoDoubt Fitness**, a personal training business. The UI reflects the NoDoubt Fitness brand throughout and includes a call to action and an About page to drive coaching inquiries.

No authentication is required. All timer data is persisted locally on the device.

---

## 2. Business Context

| Attribute | Detail |
|---|---|
| App name | HIIT Timer by NoDoubt Fitness (working title) |
| Business | NoDoubt Fitness — personal training |
| App purpose | Free utility tool; primary goal is to generate coaching leads |
| Monetization | None (free app) |
| Call to action | Persistent prompt to contact the trainer for coaching (e.g., "Train with me" / "Message me for coaching") |
| Instagram | Link to NoDoubt Fitness IG account (URL TBD) |

---

## 3. Data Model

### 3.1 Timer

| Field | Type | Constraints |
|---|---|---|
| `id` | string (UUID) | Auto-generated |
| `name` | string | Required, non-empty |
| `sets` | integer | Min: 1, no upper limit, default: 1 |
| `intervals` | Interval[] | Min: 1 work interval required |
| `created_at` | datetime | Auto-set on creation |
| `updated_at` | datetime | Updated on every save |

### 3.2 Interval

| Field | Type | Constraints |
|---|---|---|
| `sequence` | integer | 1-based, auto-assigned, sequential |
| `name` | string | Required, non-empty |
| `type` | enum | `warmup` \| `work` \| `rest` \| `cooldown` |
| `duration_minutes` | integer | ≥ 0; combined with seconds must be > 0 |
| `duration_seconds` | integer | 0–59; combined with minutes must be > 0 |
| `color` | string (hex/CSS) | Derived from type; see Section 3.3 |

### 3.3 Interval Type Colors

Colors are assigned per interval type and are globally configurable from the Settings page. Each type must have a unique color.

| Type | Default Color |
|---|---|
| `warmup` | Orange |
| `work` | Red |
| `rest` | Green |
| `cooldown` | Blue |

---

## 4. Business Rules

### 4.1 Interval Structure Rules

1. A timer **must** contain at least one `work` interval.
2. Every `work` interval **must** be immediately followed by a `rest` interval — no exceptions.
3. When the user adds a `work` interval and no `rest` follows it, the app **automatically inserts** a default `rest` interval after it.
4. A `warmup` interval is optional. If present, it **must** be the **first** interval.
5. A `cooldown` interval is optional. If present, it **must** be the **last** interval.
6. Interval duration **cannot be zero** (0 min 0 sec is invalid).
7. Duration has **no upper limit**.

### 4.2 Timer Execution Order

```
[warmup] → (work1 → rest1 → work2 → rest2 → ... → workN → restN) × sets → [cooldown]
```

- `warmup` runs **once** at the start, if present.
- The complete ordered sequence of all `work` and `rest` intervals repeats for the configured number of `sets`.
- `cooldown` runs **once** at the end, if present.
- `warmup` and `cooldown` are **never** repeated across sets.

**Example:** Warmup → Work1 → Rest1 → Work2 → Rest2, 3 sets:

```
Warmup → [Work1 → Rest1 → Work2 → Rest2] × 3 → Cooldown
```

---

## 5. Storage & PWA

- All timers are persisted locally using **IndexedDB**.
- No backend, no authentication, no sync.
- Built as a **Progressive Web App (PWA)**:
  - Service worker for full **offline support**
  - Web App Manifest for **Add to Home Screen**
  - **Screen Wake Lock API** — requested on timer start, released on pause/stop

---

## 6. Audio

- Audio cue plays at every **interval transition** via the Web Audio API.
- Audio context is initialized on first user interaction to comply with mobile browser autoplay policies.

---

## 7. Screen Inventory

| Screen | Route | Description |
|---|---|---|
| Timer List | `/` | Home screen; lists saved timers; persistent CTA |
| Timer Detail | `/timer/:id` | Read-only timer summary; run/edit/delete entry point |
| Timer Editor | `/timer/new` or `/timer/:id/edit` | Create or edit a timer |
| Running Timer | `/timer/:id/run` | Active execution view |
| About | `/about` | NoDoubt Fitness profile, owner bio, IG link, CTA |
| App Settings | `/settings` | Interval type color configuration |

---

## 8. Screen Specifications

### 8.1 Timer List (Home Screen)

- Lists all saved timers ordered by **most recently edited or created** (descending).
- Each timer card shows: timer name, number of sets, number of intervals, total estimated duration.
- **"New Timer"** action (button or FAB) prominently available.
- Tapping a timer navigates to the Timer Detail screen.
- **Persistent CTA banner or element** visible on this screen directing users to the About page or coaching contact (e.g., "Train with NoDoubt Fitness →").

### 8.2 Timer Detail Screen

- **Header:** Timer name, number of sets.
- **Interval list:** One visual block per interval showing sequence number, name, type (with color indicator), duration (`mm:ss`).
- **Actions:** ▶ Run, ✏️ Edit, 🗑️ Delete (with confirmation).

### 8.3 Timer Editor Screen

#### Timer-Level Fields
- Timer name (text input)
- Number of sets (numeric input, min: 1)

#### Interval Management
- Add, edit, remove, reorder intervals.
- Duration entered as minutes + seconds (two inputs).
- Business rules enforced in real-time:
  - Auto-insert `rest` after a `work` interval if none follows.
  - `warmup` locked to position 1; `cooldown` locked to last.
  - Save blocked if any duration is zero.

### 8.4 App Settings Screen

- One color picker per interval type (warmup, work, rest, cooldown).
- Enforces unique colors per type; warns and blocks save on conflict.
- Changes apply globally and immediately.

### 8.5 Running Timer Screen

#### Layout
- **Sticky header:** Timer name, set progress (e.g., "Set 2 of 4"), total remaining time.
- **Interval list:**
  - Completed intervals: visible, dimmed, marked done.
  - Current interval: highlighted, live countdown (`mm:ss`).
  - Upcoming intervals: normal/muted style.
  - Auto-scrolls to keep current interval visible.
- Audio cue at each transition; screen wake lock active.

#### Playback Controls

| Action | State | Requires Confirmation |
|---|---|---|
| Pause | Running | ✅ Yes |
| Stop | Running | ✅ Yes |
| Resume | Paused | ❌ No |
| Stop | Paused | ❌ No |

### 8.6 About Screen

The primary brand and lead generation screen.

- **Business branding:** NoDoubt Fitness name and logo (if available).
- **Owner profile:** Photo, name, short bio describing training philosophy and offer.
- **Instagram link:** Prominent link/button to the NoDoubt Fitness IG account (opens in new tab).
- **Primary CTA:** Bold, prominent call-to-action button — e.g., *"Message me for coaching"* — linking to a contact method (IG DM, WhatsApp, email — TBD with owner).
- **Tone:** Motivational, personal, confident — consistent with the NoDoubt Fitness brand voice.
- Accessible from the main navigation on all screens.

---

## 9. Navigation & Brand Presence

- A **bottom navigation bar** (mobile-native pattern) provides access to: Timer List, About, Settings.
- The **NoDoubt Fitness brand** (wordmark or logo) appears in the app header/navigation — not as a distraction during active timer use, but visible on all non-running screens.
- The **CTA** (coaching prompt) is present on the Timer List and About screens. It is hidden during active timer execution to avoid distraction.

---

## 10. Non-Functional Requirements

| Requirement | Detail |
|---|---|
| Platform | PWA; mobile-first (touch-optimized, responsive) |
| Authentication | None |
| Data persistence | IndexedDB, local device only |
| Offline support | Full offline via service worker |
| Wake lock | On timer start; released on pause/stop |
| Audio | Web Audio API; unlocked on first user gesture |
| Timer accuracy | Date-based delta for drift correction |
| Accessibility | Tap targets ≥ 44×44px; color contrast compliance |
| Brand | See `BRAND.md` for visual identity, aesthetic direction, and design tokens |

---

## 11. Out of Scope (v1)

- User accounts or cloud sync
- Timer sharing or export
- In-app messaging or booking system
- Pre-built timer templates
- Audio customization
- Wearable / smartwatch integration

---

*Maintain alongside `BRAND.md` and `DEPLOYMENT.md`. Advance to v0.4 when implementation begins.*

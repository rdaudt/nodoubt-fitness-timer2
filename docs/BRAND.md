# NoDoubt Fitness — Brand & UI Design Reference
> Used by: HIIT Timer PWA  
> Read alongside: `hiit-timer-prd.md`

---

## 1. Brand Identity

| Attribute | Detail |
|---|---|
| Business name | NoDoubt Fitness |
| Tagline | "Results. Confidence. No Doubt." |
| Category | Online personal training & nutrition coaching |
| Certification | BCRPA Certified Personal Trainer |
| Tone | Confident, motivational, direct, personal |
| Primary CTA | "DM me for coaching" |
| CTA destination | Instagram DM (see IG handle below) |
| Instagram bio | "📲 Online Coaching. Message me for workout plans! · 💪 BCRPA PT · 🥗 Training + Nutritional Guidance · Results. Confidence. No Doubt." |
| Instagram | ⚠️ TBD — add full URL when confirmed |

---

## 2. Logo

**File:** `nodoubt-fitness-logo.jpeg`

### Description
- **Monogram:** Bold "ND" lettermark in black with a gold upward-sweeping arrow overlaid — communicates growth and momentum.
- **Wordmark:** "NODOUBT" in heavy black caps; "FITNESS" in gold spaced caps with flanking dashes beneath.
- **Colors:** Black (`#0A0A0A`) and gold gradient (approx. `#C9960C` to `#F0C93A`).
- **Background:** White in source file.

### Usage Notes
- ⚠️ **A PNG with transparent background is needed** for use on dark app backgrounds. Request from owner or recreate from the JPEG.
- On dark backgrounds, the black letterform will need a white or light outline/glow, OR use only the gold elements — to be decided during implementation.
- The wordmark works well as a header element on the Timer List and About screens.
- Do not place the logo on the running timer screen — keep that view distraction-free.

---

## 3. Color Palette

The logo establishes the true brand palette: **black and gold**. This replaces the lime/green accent referenced in the initial design exploration. Gold on near-black is premium, bold, and distinctive — consistent with the brand's confidence and achievement positioning.

| Role | Value | Usage |
|---|---|---|
| Background | `#0A0A0A` | App background |
| Surface | `#141414` | Cards, bottom nav, modals |
| Surface elevated | `#1E1E1E` | Input fields, secondary cards |
| Accent (primary) | `#D4A017` | CTAs, active states, highlights, progress indicators |
| Accent (light) | `#F0C93A` | Hover/press state; gradient high end |
| Accent (deep) | `#A37910` | Gradient low end; pressed state |
| Text primary | `#FFFFFF` | Headings, primary labels |
| Text secondary | `#8A8A8A` | Subtitles, metadata, inactive nav |
| Text on accent | `#0A0A0A` | Text placed on gold accent backgrounds |
| Destructive | `#FF4444` | Delete actions, error states |
| Border / divider | `#2A2A2A` | Subtle separators |

### Gold Gradient (for logo echo / hero elements)
```css
background: linear-gradient(135deg, #C9960C 0%, #F0C93A 50%, #A37910 100%);
```

> Gold should be used with restraint — on primary CTAs, active nav, countdown highlights, and key accents only. The power of this palette comes from contrast: deep black field, gold that pops.

---

## 4. Typography

### 4.1 Font Roles

| Role | Font | Weight | Usage |
|---|---|---|---|
| Display / Hero | **Barlow Condensed** | 800–900 | Screen titles, timer names, countdown, interval names in running view |
| Body / UI | **DM Sans** | 400–600 | Labels, descriptions, nav items, form fields, bio copy |

Both available free on Google Fonts. The condensed heavy display face paired with a clean geometric body face mirrors the logo's own typographic contrast between "NODOUBT" (heavy) and "FITNESS" (spaced, lighter).

### 4.2 Type Scale (mobile)

| Role | Size | Weight |
|---|---|---|
| Hero / Countdown | 64–80px | 900 |
| Screen title | 28–32px | 800 |
| Section heading | 20px | 700 |
| Card title | 16–18px | 600 |
| Body / label | 14px | 400 |
| Caption / metadata | 12px | 400 |

---

## 5. Owner Profile

**File:** `owner.jpg`

| Attribute | Detail |
|---|---|
| Setting | Commercial gym, authentic training environment |
| Style | Action/training shot — holding barbell, sleeveless, cap |
| Tone | Real, approachable, credible — not overly produced |
| Usage | About screen profile section |

### Notes
- Current photo works well for the About screen as-is.
- ⚠️ Owner has indicated a better photo will be provided — replace when available.
- For the About screen hero, consider a dark overlay on the photo to allow text legibility if used as a background element.
- Photo should be displayed in a portrait crop or square with rounded corners (16px radius) depending on layout.

### About Screen Copy (from IG bio)
Use the following as the basis for the About screen bio — refine with owner:

> *BCRPA Certified Personal Trainer offering online coaching, personalized workout plans, and nutritional guidance. Results. Confidence. No Doubt.*

---

## 6. Component Patterns

### Cards
- Background: Surface `#141414`
- Border radius: 16px
- Padding: 16px
- Optional border: 1px solid `#2A2A2A`

### Buttons
- **Primary CTA:** Gold accent fill (`#D4A017`), black text (`#0A0A0A`), bold, full-width or prominent, border-radius 12px
- **Secondary:** Surface fill, white text, border `#2A2A2A`
- **Destructive:** Red fill or red-bordered
- **Min tap target:** 48×48px

### Bottom Navigation
- Background: `#141414` with top border `#2A2A2A`
- Active item: Gold accent icon + label
- Inactive: `#8A8A8A`

### Interval Type Color Chips
Displayed as a bold left-border accent or color-filled pill badge alongside the interval name. These use the configurable interval type colors (separate from brand palette — see PRD Section 3.3).

---

## 7. Iconography

- Recommended set: **Lucide Icons** or **Phosphor Icons** (open source, stroke-based, consistent weight)
- Default state: white or `#8A8A8A`
- Active state: gold accent `#D4A017`

---

## 8. Motion & Animation

- **Interval transitions:** Smooth fade or slide when the running timer advances.
- **Countdown ring/arc:** Animated circular progress indicator in gold around the active countdown.
- **CTA pulse:** Subtle pulse on the primary coaching CTA button (gentle, single loop — not distracting).
- **Page transitions:** Slide-in from right (forward); slide-out (back).
- **Duration:** 200–300ms. Snappy — this is a performance app.

---

## 9. Brand Assets — Status

| Asset | Status | Notes |
|---|---|---|
| Logo / wordmark | ✅ Available | `nodoubt-fitness-logo.jpeg` — ⚠️ transparent PNG version needed |
| Owner photo | ✅ Available (interim) | `owner.jpg` — better photo coming |
| Tagline | ✅ Confirmed | "Results. Confidence. No Doubt." |
| CTA copy | ✅ Confirmed | "DM me for coaching" |
| CTA destination | ✅ Confirmed | Instagram DM |
| Instagram handle/URL | ⚠️ TBD | Add full URL when confirmed |
| About screen bio copy | ⚠️ Draft | Based on IG bio — confirm final wording with owner |

---

*Update ⚠️ TBD items before final production build. All confirmed items are locked.*

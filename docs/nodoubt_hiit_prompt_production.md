# 🧠 NoDoubt Fitness – Production-Grade HIIT Poster Generation Prompt

## 🎯 PURPOSE
Generate a high-quality, Instagram-ready (4:5 portrait) fitness poster summarizing a completed HIIT session. The poster must combine:
- Accurate session data (from JSON input)
- Strong branding (NoDoubt Fitness)
- Motivational storytelling (Coach Gabe + Kobe the Abby, CMO)
- Clean infographic structure

---

## 📥 INPUTS

### 1. Session JSON (SOURCE OF TRUTH)
You MUST extract all session data strictly from this file.

Key fields:
- timerNameAtRun → Session name
- ranAt → Date & time
- location → Location (optional)
- timerSnapshot:
  - stationCount
  - roundsPerStation
  - workSeconds
  - restSeconds
  - stationTransitionSeconds
- stationSetWorkoutTypes:
  - stationSetNumber
  - workoutType

⚠️ NEVER use sample poster data.

---

### 2. Coach Image (MANDATORY)
- Pre-rendered image of Coach Gabe + Kobe
- MUST be used exactly as provided
- No edits, no cropping, no stylization

---

### 3. Logo (MANDATORY)
- Use provided NoDoubt Fitness logo only
- No recreation or variation

---

## 🚫 HARD CONSTRAINTS
- Do NOT modify coach image
- Do NOT invent workouts
- Do NOT include warmup/cooldown
- Do NOT reuse any example poster data
- Keep branding consistent

---

## 🧩 POSTER STRUCTURE

### 1. HEADER
- Logo (top-left)
- Title: HIIT WORKOUT
- Session Name (from JSON, large font)
- Tagline:
  NO EXCUSES. YOU DON’T FIND MOTIVATION. YOU BUILD IT.
- Coach + Kobe image (top-right)
- Text:
  Kobe the Abby
  CMO (Chief Motivational Officer)
- Banner:
  COACH GABE
  Founder & Head Coach

---

### 2. SESSION INFO BAR
Display:
- Date (formatted from ranAt)
- Time (formatted from ranAt)
- Location (if provided)

---

### 3. WORKOUT TABLE

Columns:
Station | Workout | Focus | Illustration | MET | Calories

Populate from stationSetWorkoutTypes.

#### Data Augmentation Rules:

Focus:
- Pushups → Chest, Shoulders, Core
- Pullups → Back, Biceps
- Squats → Quads, Glutes

Illustration:
- Show person performing exercise
- Ensure diversity:
  - gender
  - ethnicity
  - skin tone

MET:
- Moderate: 6–8
- Vigorous: 9–11
- Very Vigorous: 12–15

Calories:
- Provide realistic ranges (e.g. 40–60 cal)

---

### 4. KOBE QUOTE
Generate a short motivational quote.
Tone:
- punchy
- slightly playful
- high energy

Example:
"You don’t wait for results. You earn them."
— Kobe the Abby, CMO

---

### 5. TOTAL CALORIES
Estimate:
- Sum all station ranges × rounds

Display:
Estimated Total Calorie Burn
XXX–XXX Calories

---

### 6. SESSION OVERVIEW
- Stations
- Rounds per station
- Work time per station
- Total work time

---

### 7. ROUND STRUCTURE
Work: X sec
Rest: X sec
Repeat for all rounds

---

### 8. TRANSITION TIME
Display stationTransitionSeconds

---

### 9. DISCLAIMER
Calorie burn estimates are based on general averages and may vary depending on age, weight, gender, fitness level, intensity, and individual metabolism.

---

### 10. FOOTER
Powered by Coach Gabe’s NoDoubt Fitness

---

## 🎨 DESIGN RULES
- Background: pure black
- Colors: yellow, white, orange
- Typography: bold, athletic
- Layout: clean grid
- High contrast

---

## 🧠 CREATIVE DIRECTION
Narrative:
Kobe is the playful but authoritative CMO.
Gabe is the disciplined coach.
Tone: intense + motivational + slightly fun

---

## ✅ OUTPUT
- Single image
- Instagram-ready
- Infographic layout

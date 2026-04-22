---
name: NoDoubt Fitness
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d3c5ae'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#9b8f7a'
  outline-variant: '#4f4634'
  surface-tint: '#f6be39'
  primary: '#f6be39'
  on-primary: '#402d00'
  primary-container: '#d4a017'
  on-primary-container: '#503a00'
  inverse-primary: '#795900'
  secondary: '#eac334'
  on-secondary: '#3c2f00'
  secondary-container: '#c3a001'
  on-secondary-container: '#463800'
  tertiary: '#92db15'
  on-tertiary: '#213600'
  tertiary-container: '#7aba00'
  on-tertiary-container: '#2a4500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdfa0'
  primary-fixed-dim: '#f6be39'
  on-primary-fixed: '#261a00'
  on-primary-fixed-variant: '#5c4300'
  secondary-fixed: '#ffe07f'
  secondary-fixed-dim: '#eac334'
  on-secondary-fixed: '#231b00'
  on-secondary-fixed-variant: '#564500'
  tertiary-fixed: '#adf83a'
  tertiary-fixed-dim: '#92db15'
  on-tertiary-fixed: '#112000'
  on-tertiary-fixed-variant: '#314f00'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  timer-display:
    fontFamily: Lexend
    fontSize: 120px
    fontWeight: '900'
    lineHeight: 110px
    letterSpacing: -0.05em
  headline-xl:
    fontFamily: Lexend
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Lexend
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  container-padding: 20px
  gutter: 16px
---

## Brand & Style

This design system is engineered for elite performance and high-intensity interval training. The brand personality is aggressive, disciplined, and premium, catering to athletes who demand clarity and focus under physical duress. 

The visual style is **High-Contrast / Bold**, utilizing a "Void" aesthetic where deep black backgrounds eliminate distractions, and high-energy gold accents serve as the primary drivers of action. The interface borrows from luxury automotive and high-end horology, using metallic-inspired gradients and sharp, intentional geometry to convey a sense of precision and speed. The experience is designed to feel like a high-performance instrument rather than a typical mobile utility.

## Colors

The color palette is dominated by **Absolute Black** to maximize the OLED contrast ratio, ensuring the display remains legible even in bright gym environments or during rapid movement. 

- **Gold Accents:** A dual-tone gold system provides a metallic luster. `#D4A017` is used for primary branding and inactive states, while `#F0C93A` acts as a high-visibility "active" state.
- **Interval Semantic Colors:** High-saturation tones are mapped to specific timer states to allow for "peripheral recognition." An athlete should know their phase by the hue reflecting off their environment without looking directly at the digits.
- **Surface Tiers:** Backgrounds use `#0A0A0A`, while interactive cards and containers use `#141414` to provide a subtle structural silhouette.

## Typography

The typography system is built on two pillars: **Power** and **Precision**.

- **Lexend** is utilized for all headers and the central timer display. Chosen for its athletic, geometric clarity, it is used exclusively in "Extra Bold" or "Black" weights. The `timer-display` token is optimized for maximum vertical impact, ensuring the time remaining is the most prominent element in the visual hierarchy.
- **Manrope** provides a balanced, technical counterpoint for body text and UI metadata. It maintains readability during movement.
- **Styling Note:** All labels for interval types (e.g., "WARMUP") should use the `label-caps` token to maintain a disciplined, architectural feel.

## Layout & Spacing

This design system utilizes a **Fixed Grid** approach for mobile views to maintain strict control over alignment and "impact zones." 

The spacing rhythm is based on a **4px baseline**, with a standard container margin of **20px** to ensure content does not bleed into the bezel. Layouts should prioritize vertical stacking of large-scale elements. In the "Active Timer" view, the layout shifts to a **No Grid** approach, centering the timer digits perfectly in the viewport with massive safe-area padding to allow for high-speed glancing.

## Elevation & Depth

To maintain the premium "high-performance" feel, the system avoids traditional drop shadows in favor of **Tonal Layers** and **Glows**.

- **Surface Tiers:** Hierarchy is established by stepping up from `#0A0A0A` (base) to `#141414` (cards). 
- **Luminescent Depth:** Instead of shadows, active elements or "Work" intervals utilize a soft, colored outer glow (e.g., a 20px blur of the Red interval color at 15% opacity) to suggest the interface is "emitting light."
- **Metallic Gradients:** Primary buttons use a subtle linear gradient from `#D4A017` to `#F0C93A` at a 135-degree angle to simulate a brushed-gold finish.

## Shapes

The shape language is defined by **Precision-Cut Geometry**. 

Elements use a standard corner radius of **12-16px**, creating a "squircle" effect that feels modern and approachable but retains a structural stiffness. Smaller UI components like chips or tags use the same radius to maintain consistency. In specific "Extreme" modes, the radius may be reduced to 0px (sharp) for a more brutalist, aggressive appearance, but the default state is moderately rounded to provide a tactile, premium feel.

## Components

- **The Chrono-Display:** The central timer component. It features the `timer-display` font. When the timer is active, the border of the screen or the card container should pulse with the semantic interval color (Orange, Red, Green, or Blue).
- **Action Buttons:** Large-scale (minimum 64px height) with the gold gradient. Text is always centered, bold, and uppercase.
- **Interval Cards:** Surfaces using `#141414` with a 2px left-accent border matching the interval type color.
- **Selection Chips:** Used for setting durations. These are outlined in dark grey when inactive and filled with gold when active.
- **Progress Ring:** A thin (4px stroke) circular track around the timer digits. The "track" is `#1E1E1E`, and the "progress" is the primary Gold or the specific interval color.
- **Control Bar:** A fixed bottom area containing Start/Stop/Reset, utilizing high-contrast icons and minimal labeling.
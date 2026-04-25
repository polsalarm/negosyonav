\---

name: NegosyoNav Core
colors:
surface: '#f5fbf5'
surface-dim: '#d6dbd6'
surface-bright: '#f5fbf5'
surface-container-lowest: '#ffffff'
surface-container-low: '#eff5ef'
surface-container: '#eaefea'
surface-container-high: '#e4eae4'
surface-container-highest: '#dee4de'
on-surface: '#171d1a'
on-surface-variant: '#3d4943'
inverse-surface: '#2c322e'
inverse-on-surface: '#ecf2ed'
outline: '#6d7a73'
outline-variant: '#bccac1'
surface-tint: '#006c4e'
primary: '#00694c'
on-primary: '#ffffff'
primary-container: '#008560'
on-primary-container: '#f5fff7'
inverse-primary: '#68dbae'
secondary: '#086b53'
on-secondary: '#ffffff'
secondary-container: '#a0f3d4'
on-secondary-container: '#167159'
tertiary: '#554cb9'
on-tertiary: '#ffffff'
tertiary-container: '#6e66d4'
on-tertiary-container: '#fffbff'
error: '#ba1a1a'
on-error: '#ffffff'
error-container: '#ffdad6'
on-error-container: '#93000a'
primary-fixed: '#86f8c9'
primary-fixed-dim: '#68dbae'
on-primary-fixed: '#002115'
on-primary-fixed-variant: '#00513a'
secondary-fixed: '#a0f3d4'
secondary-fixed-dim: '#84d6b9'
on-secondary-fixed: '#002117'
on-secondary-fixed-variant: '#00513e'
tertiary-fixed: '#e3dfff'
tertiary-fixed-dim: '#c5c0ff'
on-tertiary-fixed: '#140067'
on-tertiary-fixed-variant: '#3f35a3'
background: '#f5fbf5'
on-background: '#171d1a'
surface-variant: '#dee4de'
typography:
headline-lg:
fontFamily: Plus Jakarta Sans
fontSize: 28px
fontWeight: '700'
lineHeight: 36px
headline-md:
fontFamily: Plus Jakarta Sans
fontSize: 24px
fontWeight: '700'
lineHeight: 32px
headline-sm:
fontFamily: Plus Jakarta Sans
fontSize: 22px
fontWeight: '600'
lineHeight: 28px
body-lg:
fontFamily: Plus Jakarta Sans
fontSize: 18px
fontWeight: '500'
lineHeight: 26px
body-md:
fontFamily: Plus Jakarta Sans
fontSize: 16px
fontWeight: '500'
lineHeight: 24px
label-md:
fontFamily: Plus Jakarta Sans
fontSize: 14px
fontWeight: '600'
lineHeight: 20px
letterSpacing: 0.5px
rounded:
sm: 0.25rem
DEFAULT: 0.5rem
md: 0.75rem
lg: 1rem
xl: 1.5rem
full: 9999px
spacing:
unit: 4px
margin-edge: 20px
gutter: 16px
touch-target-min: 48px
touch-target-preferred: 56px
stack-sm: 8px
stack-md: 16px
stack-lg: 24px
---

## Brand \& Style

This design system is built on the principles of **Bayanihan Modernism**. It rejects the cold, sterile aesthetics of traditional banking and government portals in favor of a "Digital Kapitbahay" (Digital Neighbor) persona. The style is **Corporate/Modern** but softened with organic roundness and a warm, tactile palette to ensure micro-entrepreneurs feel welcomed rather than intimidated.

The interface prioritizes extreme legibility and physical ease of use, acknowledging a demographic that may include senior business owners or those using entry-level mobile devices in high-glare environments. The visual language is grounded, utilizing "Growth Greens" and "Trust Teals" to signal financial progress, while maintaining a conversational, Taglish-friendly tone throughout the micro-copy.

## Colors

The color strategy is designed to balance financial authority with neighborhood familiarity.

* **Primary Forest Green (#1D9E75):** Used for primary actions and brand presence. It signals liquidity and the "green light" for business growth.
* **Deep Teal Accent (#0F6E56):** Reserved for emphasis, active states, and high-contrast text on light backgrounds.
* **Warm Gray Neutral:** The background (#F1EFE8) mimics the off-white paper of traditional ledgers, reducing eye strain and feeling more "organic" than pure white. Text (#5F5E5A) stays in the charcoal range to maintain high contrast without the harshness of pure black.
* **Contextual Signals:**

  * **Purple (#534AB7):** The "Community Hub" color, distinct from financial tools to signal social interaction.
  * **Amber (#BA7517):** Dedicated exclusively to Grants and urgent opportunities, ensuring these "golden" moments are never missed.

## Typography

This design system utilizes **Plus Jakarta Sans** for its high x-height and open apertures, which improve readability on small screens. **Noto Sans Filipino** is used as the system fallback to ensure all local glyphs and diacritics are rendered perfectly.

**Weight \& Scale Rules:**

* **No Light Weights:** Minimum font weight is 500 (Medium). This ensures text remains visible for users with declining vision or on low-quality displays.
* **Senior-Friendly Sizing:** The base body size is 16sp, pushing to 18sp for critical instructional text. Headings are aggressive (22sp-28sp) to provide clear landmarks within the app hierarchy.
* **Language Alignment:** Typography must account for Taglish phrasing, which often results in longer word strings than pure English. Line heights are generous to prevent descenders from touching the line below.

## Layout \& Spacing

The layout follows a **Fluid Grid** model optimized for the wide variety of Android devices common in the Philippines.

* **Edge Margins:** A 20px "safe zone" is maintained on the left and right to accommodate phone cases and prevent accidental palm touches while navigating.
* **Touch Targets:** A strict minimum of 48dp is enforced, with a preference for 56dp for primary business actions (e.g., "Add Sales").
* **Vertical Rhythm:** Elements are stacked using an 8px-based system, but padding inside cards is increased to 16px or 20px to ensure the UI feels airy and unhurried.

## Elevation \& Depth

To maintain a "modern-accessible" look, this design system avoids heavy, muddy shadows which can make the UI look cluttered on lower-end screens.

* **Low-Contrast Outlines:** Hierarchy is established through **hairline borders** (1px solid) using a slightly darker version of the surface color (e.g., #D1CDC2 over the #F1EFE8 background).
* **Tonal Layering:** Depth is conveyed by placing cards (#FFFFFF) onto the warm gray background.
* **Active States:** Instead of raising an element through shadows when pressed, the design system uses "Inward Tones"—changing the background color to the Surface Light Green (#E1F5EE) or the Deep Teal (#0F6E56) for buttons.

## Shapes

The shape language is defined by **Soft Friendliness**.

* **Main Cards:** 12dp (0.75rem) corner radius. This creates a distinct "friendly" container that feels safe and approachable.
* **Buttons:** 12dp or fully rounded pills for secondary chips.
* **Icons:** Use rounded caps and joins. Avoid sharp 90-degree angles in any UI framing.
* **Consistency:** All interactive elements must share the 12dp radius to create a rhythmic visual pattern that the user associates with "clickable."

## Components

### Buttons

Primary buttons are Forest Green with white text, 56dp height, and bold 18sp text. Secondary buttons use a Deep Teal hairline border with no fill. "Destructive" actions are never just red; they are accompanied by clear Taglish confirmation text.

### Cards (The "Negosyo Container")

The primary unit of the UI. Cards must have a 1px hairline border (#D1CDC2) and 12dp corners. They should not use shadows. Internal padding should be 16dp minimum.

### Inputs

Input fields must have persistent labels (no disappearing placeholders). The active stroke is 2px Deep Teal. Touch targets for inputs must be 56dp high to ensure ease of entry for manual sales logging.

### Chips \& Badges

* **Community Chips:** Use Purple (#534AB7) with white text.
* **Grant Badges:** Use Amber (#BA7517) with a subtle #FEF3E2 background.

### Lists

List items use 16dp vertical padding and a bottom hairline divider. Every list item with a "chevron" must have a minimum 48dp hit area to ensure the user doesn't miss the tap target.


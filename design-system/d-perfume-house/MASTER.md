# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** D Perfume House
**Updated:** 2026-03-26
**Category:** E-commerce Luxury

---

## Global Rules

### Color Palette (HSL CSS Variables)

| Role | HSL Value | Approx Hex | CSS Variable |
|------|-----------|------------|--------------|
| Primary (Gold) | `36 25% 53%` | `#A58D69` | `--primary` |
| Secondary (Beige) | `37 48% 79%` | `#E3CFB0` | `--secondary` |
| Background (Light) | `40 20% 97%` | `#F8F5F0` | `--background` |
| Foreground (Dark) | `40 46% 5%` | `#130F07` | `--foreground` |
| Muted | `37 30% 92%` | `#EDE8E0` | `--muted` |
| Border | `37 30% 85%` | `#DDD5C8` | `--border` |
| Cream | `40 30% 95%` | `#F5F1EB` | `--cream` |

**Custom Tokens:**
| Token | Value | Usage |
|-------|-------|-------|
| `--gold` | `36 25% 53%` | Gold accent elements |
| `--beige` | `37 48% 79%` | Warm secondary tones |
| `--deep-black` | `40 46% 5%` | Dark backgrounds, text |
| `--cream` | `40 30% 95%` | Light surface variation |

**Dark Mode:** Supported via `.dark` class on `<html>`. Dark mode inverts background/foreground and adjusts card/muted/border tones while keeping the warm gold primary consistent.

**Color Notes:** Warm, elegant gold & beige palette. All accent colors are gold-based — no purple. WCAG 4.5:1 contrast maintained.

### Typography

- **Body Font:** Outfit (weights: 300, 400, 500, 600)
- **Display Font:** Cormorant Garamond (weights: 400, 500, 600, 700)
- **Mood:** luxury, elegant, warm, sophisticated, refined, premium
- **Google Fonts:** [Outfit + Cormorant Garamond](https://fonts.google.com/share?selection.family=Cormorant+Garamond:wght@400;500;600;700|Outfit:wght@300;400;500;600)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Outfit:wght@300;400;500;600&display=swap');
```

**Usage:**
- Body text: `font-family: Outfit, system-ui, sans-serif;`
- Headings (h1-h6): `font-family: Cormorant Garamond, Georgia, serif;`
- Tailwind: `font-sans` (Outfit), `font-display` (Cormorant Garamond)

### Gradients

| Token | Value | Usage |
|-------|-------|-------|
| `--gradient-gold` | `linear-gradient(135deg, hsl(36,25%,53%) 0%, hsl(37,48%,79%) 100%)` | Gold gradient fills |
| `--gradient-dark` | `linear-gradient(180deg, hsl(40,46%,5%) 0%, hsl(40,30%,15%) 100%)` | Dark section backgrounds |
| `--gradient-hero` | `linear-gradient(180deg, rgba(19,15,7,.7) 0%, rgba(19,15,7,.4) 50%, rgba(19,15,7,.8) 100%)` | Hero overlay |

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-elegant` | `0 4px 20px -2px hsla(36,25%,53%,.15)` | Subtle gold lift |
| `--shadow-card` | `0 8px 30px -4px hsla(40,46%,5%,.08)` | Card shadows |
| `--shadow-gold` | `0 8px 25px -5px hsla(36,25%,53%,.3)` | Prominent gold glow |

---

## Component Specs

### Buttons

```css
/* Primary Button — Gold */
.btn-primary {
  background: hsl(36, 25%, 53%);
  color: hsl(40, 20%, 97%);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button — Outlined */
.btn-secondary {
  background: transparent;
  color: hsl(36, 25%, 53%);
  border: 2px solid hsl(36, 25%, 53%);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-card);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-elegant);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid hsl(var(--input));
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

.input:focus {
  border-color: hsl(var(--primary));
  outline: none;
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.2);
}
```

### Modals

```css
.modal-overlay {
  background: hsl(var(--deep-black) / 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: hsl(var(--card));
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-gold);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Warm Luxury Elegance

**Keywords:** Warm gold, elegant beige, premium feel, refined typography, smooth transitions, subtle shadows, sophisticated gradients

**Best For:** Luxury e-commerce, premium products, high-end brand experiences, perfume houses

**Key Effects:** Subtle shadows, warm gradients, elegant hover transitions (200ms), gold accent glow

### Page Pattern

**Pattern Name:** Bento Grid Showcase

- **Conversion Strategy:** Scannable value props. High information density without clutter. Mobile stack.
- **CTA Placement:** Floating Action Button or Bottom of Grid
- **Section Order:** 1. Hero, 2. Bento Grid (Key Features), 3. Detail Cards, 4. Tech Specs, 5. CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Purple accents (use gold/beige only)
- ❌ Vibrant & Block-based
- ❌ Playful colors
- ❌ Cold/blue-toned grays (use warm tones)

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
- [ ] Colors use HSL CSS variables, not hardcoded hex
- [ ] Font: Outfit for body, Cormorant Garamond for headings
- [ ] No purple accents — gold/beige palette only

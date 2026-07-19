# Bino Hlongwana | Portfolio

A portfolio built as one continuous scrolling journey — five destinations (Home, Experience, About, Certifications, Contact) connected by a morphing star map and a WebGL aurora, looping seamlessly back to the start.

![Angular](https://img.shields.io/badge/Angular_19-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

---

## 📚 Start Here: The Onboarding Doc

The best way to understand how everything works together is the **[interactive engineering onboarding guide](docs/onboarding.html)** — a self-contained HTML doc (no build step, no dependencies; just open `docs/onboarding.html` in any browser). It walks through:

- **Quick Start** — prerequisites, install & run, script reference, deployment
- **Architecture** — the star-map wayfinding concept, an interactive system diagram, the scroll loop that acts as the site's spine, signals and the 60fps hot path, and the theming model
- **Component Map** — a directory tour, why there is no router, every component, core service, and data file
- **Modification Guide** — step-by-step recipes for adding a project, updating certifications, tweaking the constellation, tuning the aurora, and adding a whole new destination

Supporting references:

- **[CONTEXT.md](CONTEXT.md)** — the design-language glossary
- **[docs/adr](docs/adr)** — Architecture Decision Records for every significant design choice

---

## ✨ Features

- **Looping Scroll** — The page scrolls through all five sections and wraps invisibly back to the top via a cloned seam, so the journey never ends
- **Morphing Star Map** — An SVG constellation interpolates between figures as you scroll, acting as wayfinding for where you are in the loop
- **WebGL Aurora** — A GLSL simplex-noise shader (via [OGL](https://github.com/oframe/ogl)) renders a living aurora behind every section
- **Single Frame Loop** — One shared `requestAnimationFrame` pulse runs outside Angular's zone and drives every animation, keeping change detection off the hot path
- **Certification Spotlight** — Each certification opens full-size in a focus-trapped overlay with a verify link; on fine pointers a floating preview tethers to the cursor
- **Marquee Email** — The Contact finale features a large marquee email with one-click copy-to-clipboard, plus a colophon with a live SAST clock
- **Theme Toggle** — Dark/light mode with system preference detection, `localStorage` persistence, and a signals-based `ThemeService` the whole app reacts to
- **Accessible** — Semantic HTML, ARIA labels, keyboard navigation, and full `prefers-reduced-motion` support (the morph and aurora settle down when asked)
- **Responsive** — Optimized layouts for desktop, tablet, and mobile
- **CV Download** — One click, straight to your downloads folder — recruiters, this one's for you ;)

---

## 🛠️ Tech Stack

| Category       | Technologies                                      |
|----------------|---------------------------------------------------|
| Framework      | Angular 19 (NgModules + Signals)                  |
| Language       | TypeScript 5.6                                    |
| Graphics       | OGL (WebGL2 shader), SVG morphing                 |
| Styling        | CSS3 (Custom Properties, Flexbox, Grid)           |
| Icons          | Font Awesome                                      |
| Testing        | Jasmine + Karma                                   |
| Hosting        | Netlify                                           |

---

## 🏗️ How It Works

The scroll loop is the spine of the site. `ScrollLoopService` owns the reader's **cycle position** (0 = Home, 1 = Experience, … wrapping at the seam) with the arithmetic extracted into pure, unit-tested functions in `scroll-loop.math.ts`. The app shell feeds it raw scroll offsets; everything else — the constellation morph, the loop-aware nav muting — reads the position signal from a shared frame pulse without ever triggering change detection at 60fps.

There is deliberately **no Angular Router**: the five destinations are defined once in `src/app/destinations.ts` and composed into a single looping page by the app shell.

Every significant design decision is recorded as an ADR in [docs/adr](docs/adr) — from the initial immersion-first concept to the seamless clone-wrap and the glass-card surface treatment. For the full picture of how these pieces interlock, read the **[onboarding guide](docs/onboarding.html)**.

---

## 📁 Project Structure
```
src/app/
├── aurora/                    # WebGL aurora background (OGL + GLSL shader, CSS fallback)
├── constellation/             # Morphing star map (figures, morph driver, interpolation)
├── core/                      # Services: frame pulse (shared rAF), theme, motion settings,
│                              #   in-viewport, scroll lock, nav transitions, aurora palette
├── landingpage/               # Home / hero section + CV download
├── layout/site-nav/           # Navigation with loop-aware muting
├── pages/
│   ├── work/                  # Experience timeline (work-data.ts)
│   ├── about/
│   ├── certifications/        # Spotlight overlay (certifications-data.ts, certifications.math.ts)
│   └── contact/               # Marquee email, channels, colophon with live SAST clock
├── shared/                    # display-heading, theme-toggle
├── destinations.ts            # Single source of truth for the five destinations
├── scroll-loop.service.ts     # Scroll cycle state + seam wrap
├── scroll-loop.math.ts        # Pure scroll math (unit-tested)
└── scroll-reveal.directive.ts # Fade-in-on-scroll behavior
docs/
├── onboarding.html            # ⭐ Interactive engineering onboarding guide — start here
└── adr/                       # Architecture Decision Records
CONTEXT.md                     # Design-language glossary
```

---

## 🏃 Getting Started

### Prerequisites

- Node.js (v18.19+)
- Angular CLI (`npm install -g @angular/cli`)

### Installation
```bash
# Clone the repository
git clone https://github.com/Robotbino/PorfolioWebsite.git

# Navigate to project directory
cd PorfolioWebsite

# Install dependencies
npm install

# Start development server
npm start
```

Visit `http://localhost:4200` in your browser. For a rebuilding dev bundle without a server, use `npm run watch`.

### Tests
```bash
npm test
```
The pure logic lives in unit-tested modules with colocated specs — scroll math, constellation morph and driver, frame pulse, theme decisions, certifications math, destinations, aurora palette, and motion math.

---

## 🚀 Deployment

The site deploys to **Netlify** via [netlify.toml](netlify.toml):

- Build: `ng build --configuration production`
- Publish directory: `dist/professional-porfolio/browser`
- SPA fallback: `/* → /index.html 200` (also mirrored in `src/_redirects`)

---

## 📸 Screenshots

<details>
<summary>Click to expand</summary>

### Dark Mode
![Portfolio in dark mode](src/assets/portfolio_dark_mode.png)

### Light Mode
![Portfolio in light mode](src/assets/portfolio_light_mode.png)

</details>

---

## 📬 Contact

**Bino Hlongwana** :)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/bino-hlongwana-162226272)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white)](https://github.com/Robotbino)
[![Email](https://img.shields.io/badge/Email-D14836?style=flat&logo=gmail&logoColor=white)](mailto:HlongwanaBino@gmail.com)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

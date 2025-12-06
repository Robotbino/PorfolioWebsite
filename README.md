# Bino Hlongwana | Portfolio

A modern, responsive portfolio website built with Angular, featuring dark/light theme support, smooth animations, and accessible design principles.

![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

---


## ✨ Features

- **Theme Toggle** — Switch between dark and light modes with system preference detection and localStorage persistence
- **Responsive Design** — Optimized layouts for desktop, tablet, and mobile devices
- **Smooth Animations** — CSS transitions and fade-in effects for enhanced user experience
- **Accessible** — Built with semantic HTML, ARIA labels, and keyboard navigation support
- **CV Download** — One-click download functionality for recruiters
- **Project Showcase** — Dedicated section highlighting technical projects with tech stack tags

---

## 🛠️ Tech Stack

| Category       | Technologies                          |
|----------------|---------------------------------------|
| Framework      | Angular 17+                           |
| Language       | TypeScript                            |
| Styling        | CSS3 (Custom Properties, Flexbox, Grid) |
| Icons          | Font Awesome                          |
| Architecture   | Component-based, NgModule             |

---

## 📁 Project Structure
```
src/
├── app/
│   ├── landingpage/
│   │   ├── landingpage.component.ts    # Theme logic, CV download
│   │   ├── landingpage.component.html  # Portfolio sections
│   │   └── landingpage.component.css   # Responsive styles
│   ├── app-routing.module.ts           # Route configuration
│   ├── app.module.ts                   # Root module
│   └── app.component.ts                # Root component
└── assets/
    ├── BinoHlongwanaATS-CV.pdf         # Downloadable CV
    └── [project-images]                # Project screenshots
```

---

## 🏃 Getting Started

### Prerequisites

- Node.js (v18+)
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
ng serve
```

Visit `http://localhost:4200` in your browser.

### Build for Production
```bash
ng build --configuration=production
```

---

## 📸 Screenshots

<details>
<summary>Click to expand</summary>

### Light Mode

![Hero-Desktop](https://github.com/user-attachments/assets/b0af3480-e51d-4b57-b2f5-e329cc929b0d)

### Dark Mode
![DarkMode-Hero-Desk](https://github.com/user-attachments/assets/bed26cad-3b8f-4b81-b931-b914c3e93bd0)

<img width="1919" height="1079" alt="DarkMode-AboutMe-Desktop" src="https://github.com/user-attachments/assets/3a2732f8-5e48-4c5f-b24d-ea0e3ac07b19" />


### Mobile View
![Hero-Mobile](https://github.com/user-attachments/assets/818b612b-0fa6-4939-b5c6-b2e9fc48ba19)


</details>

---

## 🎯 Key Implementation Highlights

**Theme System**
- Detects system color scheme preference via `matchMedia`
- Persists user selection in `localStorage`
- Applies theme using CSS custom properties on `:root`

**Accessibility**
- Semantic HTML5 elements (`<header>`, `<section>`, `<article>`, `<footer>`)
- ARIA labels for interactive elements and icon-only buttons
- Proper heading hierarchy for screen readers

**Performance**
- Lazy-loaded images with `loading="lazy"`
- Minimal dependencies for fast load times
- Component cleanup with `OnDestroy` lifecycle hook

---

## 📬 Contact

**Bino Hlongwana** — Full-Stack Developer

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/bino-hlongwana-162226272)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white)](https://github.com/Robotbino)
[![Email](https://img.shields.io/badge/Email-D14836?style=flat&logo=gmail&logoColor=white)](mailto:HlongwanaBino@gmail.com)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

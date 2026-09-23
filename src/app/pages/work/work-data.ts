/**
 * Static copy that drives the Work page. Lifted out of the template so the
 * markup is one *ngFor per section and the editorial content stays in TS.
 */

export interface ExperienceGroup {
  readonly label: string;
  readonly description: string;
}

export interface ProjectImage {
  readonly dark: string;
  readonly light: string;
  /**
   * Intrinsic pixel size, rendered as the <img> width/height attributes so the
   * browser knows the ratio before the lazy image decodes. Where the dark and
   * light variants differ by a few pixels (the portfolio screenshots) the dark
   * one's size is used — the cards are `object-fit: cover` inside a grid-fixed
   * box, so a sub-2% ratio difference is not observable.
   */
  readonly width: number;
  readonly height: number;
  readonly alt: {
    readonly dark: string;
    readonly light: string;
  };
  /**
   * The page this shows, in a few words ("Game details"). Read only when a
   * project has more than one screenshot: it captions the slideshow and names
   * the button that brings this screenshot up.
   */
  readonly label?: string;
  /**
   * Which part stays in view when the card crops the screenshot (a CSS
   * `object-position`, e.g. '30% 50%'). Centred when left out. On the desktop
   * layouts the image box is tall, so a wide screenshot shows only a slice.
   */
  readonly position?: string;
}

export interface Project {
  readonly title: string;
  readonly description: string;
  readonly tech: readonly string[];
  readonly href: string;
  /** Live deployment, when one exists. Renders a second "Live Demo" link. */
  readonly demoHref?: string;
  /** The first is the cover; any more turn the card's image into a slideshow. */
  readonly screenshots: readonly [ProjectImage, ...ProjectImage[]];
}

/**
 * The one role, as data rather than markup.
 *
 * `title` and `period` stay nullable: the template renders each only when it is
 * filled in, so an unknown fact is omitted rather than guessed at.
 */
export interface Role {
  readonly org: string;
  readonly descriptor: string;
  readonly title: string | null;
  readonly period: string | null;
}

export const ROLE: Role = {
  org: 'SITA',
  descriptor: 'Java EE case management & workflow platform',
  title: 'Full-Stack Developer',
  period: 'June 2023 — present',
};

export const EXPERIENCE_GROUPS: readonly ExperienceGroup[] = [
  {
    // If a label is wrong, fix the LABEL, not the list: these are claimed
    // skills, so editing the list to suit a label claims something different.
    label: 'Languages & Frameworks',
    description: 'Java, JavaScript, React, Angular',
  },
  {
    label: 'Database Management',
    description: 'SQL, Oracle, MySQL',
  },
  {
    label: 'Software Development & Web Applications',
    description: 'Spring Framework, Java EE, API Development and Testing',
  },
  {
    label: 'Tools',
    description: 'Eclipse, Visual Studio Code, GitHub, IntelliJ IDEA',
  },
  {
    label: 'Methodologies',
    description:
      'Agile, Waterfall, Systems Development Life Cycle, Design Patterns, Object-Oriented Programming',
  },
  {
    label: 'Other Skills',
    description:
      'Good Communication Skills, Teamwork, Problem Solving, Critical Thinking, Time Management, Adaptability',
  },
] as const;

export const PROJECTS: readonly Project[] = [
  {
    title: 'Memory Leak',
    description:
      'A card-matching memory game built with Angular and deployed live. Players ' +
      'flip themed cards to find pairs within a limited number of attempts, with ' +
      'score tracking and game logic handled entirely on the front end.',
    tech: ['Angular', 'JavaScript', 'CSS3', 'HTML5'],
    href: 'https://github.com/Robotbino/CodePairs.git',
    demoHref: 'https://codepairsgame.netlify.app/',
    screenshots: [
      {
        dark: '/assets/CodePairsDemo1.webp',
        light: '/assets/CodePairsDemo1.webp',
        width: 1920,
        height: 1080,
        alt: {
          dark: 'Memory Leak game showing card matching interface',
          light: 'Memory Leak game showing card matching interface',
        },
      },
    ],
  },
  {
    title: 'Employee Management System',
    description:
      'A full-stack web application for managing employee records, built with a ' +
      'Spring Boot REST API and an Angular front end. Implements JWT authentication ' +
      'and full CRUD functionality over a MySQL database for secure data handling.',
    tech: ['Spring Boot', 'Angular', 'MySQL', 'JWT'],
    href: 'https://github.com/Robotbino/EmployeeManager-Application.git',
    // The app's own light/dark theme is the point here, so the card shows
    // both whatever theme the site is in, rather than matching one to it.
    // The names and job titles sit left of centre; a centred crop cuts them.
    screenshots: [
      {
        dark: '/assets/employee-manager-table-dark.webp',
        light: '/assets/employee-manager-table-dark.webp',
        width: 1920,
        height: 888,
        alt: {
          dark: 'Employee Management System in dark mode: the employee table with names, job titles, emails, phone numbers and employee codes',
          light: 'Employee Management System in dark mode: the employee table with names, job titles, emails, phone numbers and employee codes',
        },
        label: 'Dark mode',
        position: '15% 50%',
      },
      {
        dark: '/assets/employee-manager-table-light.webp',
        light: '/assets/employee-manager-table-light.webp',
        width: 1920,
        height: 888,
        alt: {
          dark: 'Employee Management System in light mode: the same employee table',
          light: 'Employee Management System in light mode: the same employee table',
        },
        label: 'Light mode',
        position: '15% 50%',
      },
    ],
  },
  {
    title: 'Game Store',
    description:
      'A full-stack e-commerce storefront for video games, pairing a React 19 + ' +
      'TypeScript front end with a Spring Boot REST API. Features JWT authentication, ' +
      'live search with game detail pages, a personal library, and a separate admin ' +
      'portal with full CRUD backed by MySQL.',
    tech: ['React', 'TypeScript', 'Spring Boot', 'MySQL'],
    href: 'https://github.com/Robotbino/gameStore.git',
    // The store is dark-only, so each screenshot serves both site themes.
    screenshots: [
      {
        dark: '/assets/gamestore-details.webp',
        light: '/assets/gamestore-details.webp',
        width: 1920,
        height: 1080,
        alt: {
          dark: "Game Store details page for Marvel's Spider-Man Remastered, with full-bleed hero art, genre chips, a star rating and Add to Cart",
          light: "Game Store details page for Marvel's Spider-Man Remastered, with full-bleed hero art, genre chips, a star rating and Add to Cart",
        },
        label: 'Game details',
      },
      {
        dark: '/assets/gamestore-home.webp',
        light: '/assets/gamestore-home.webp',
        width: 1920,
        height: 1080,
        alt: {
          dark: 'Game Store home page with The Witcher 3 in the featured hero above a row of game cards',
          light: 'Game Store home page with The Witcher 3 in the featured hero above a row of game cards',
        },
        label: 'Store',
      },
      {
        dark: '/assets/gamestore-wishlist.webp',
        light: '/assets/gamestore-wishlist.webp',
        width: 1920,
        height: 1080,
        alt: {
          dark: 'Game Store wishlist with four saved games, each card carrying a filled heart',
          light: 'Game Store wishlist with four saved games, each card carrying a filled heart',
        },
        label: 'Wishlist',
      },
      {
        dark: '/assets/gamestore-checkout.webp',
        light: '/assets/gamestore-checkout.webp',
        width: 1920,
        height: 1080,
        alt: {
          dark: 'Game Store checkout on the payment step, with card, Stripe and Payflex options and a live card preview',
          light: 'Game Store checkout on the payment step, with card, Stripe and Payflex options and a live card preview',
        },
        label: 'Checkout',
      },
    ],
  },
  {
    title: 'Portfolio Website',
    description:
      'The site you are viewing — an Angular single-page application with a custom ' +
      'WebGL star-map and aurora driven by a single shared frame loop. The ' +
      'constellation morphs between shapes as you scroll, with full light and dark ' +
      'theming throughout.',
    tech: ['Angular', 'TypeScript', 'WebGL', 'CSS3'],
    href: 'https://github.com/Robotbino/PorfolioWebsite.git',
    screenshots: [
      {
        dark: '/assets/portfolio_dark_mode.webp',
        light: '/assets/portfolio_light_mode.webp',
        width: 1726,
        height: 873,
        alt: {
          dark: 'Portfolio website in dark mode',
          light: 'Portfolio website in light mode',
        },
      },
    ],
  },
] as const;

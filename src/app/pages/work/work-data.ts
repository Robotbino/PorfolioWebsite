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
  readonly alt: {
    readonly dark: string;
    readonly light: string;
  };
}

export interface Project {
  readonly title: string;
  readonly description: string;
  readonly tech: readonly string[];
  readonly href: string;
  /** Live deployment, when one exists. Renders a second "Live Demo" link. */
  readonly demoHref?: string;
  readonly img: ProjectImage;
}

export const EXPERIENCE_GROUPS: readonly ExperienceGroup[] = [
  {
    label: 'Programming Languages',
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
    label: 'Tools and IDEs',
    description: 'Eclipse, Visual Studio, GitHub, IntelliJ IDEA',
  },
  {
    label: 'Methodologies',
    description: 'Agile, Waterfall, Systems Development Life Cycle, Design Patterns, Object-Oriented Programming',
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
    img: {
      dark: '/assets/CodePairsDemo1.png',
      light: '/assets/CodePairsDemo1.png',
      alt: {
        dark: 'Memory Leak game showing card matching interface',
        light: 'Memory Leak game showing card matching interface',
      },
    },
  },
  {
    title: 'Employee Management System',
    description:
      'A full-stack web application for managing employee records, built with a ' +
      'Spring Boot REST API and an Angular front end. Implements JWT authentication ' +
      'and full CRUD functionality over a MySQL database for secure data handling.',
    tech: ['Spring Boot', 'Angular', 'MySQL', 'JWT'],
    href: 'https://github.com/Robotbino/EmployeeManager-Application.git',
    img: {
      dark: '/assets/EmployeeManagerInterface.jpg',
      light: '/assets/EmployeeManagerInterface.jpg',
      alt: {
        dark: 'Employee Management System dashboard interface',
        light: 'Employee Management System dashboard interface',
      },
    },
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
    img: {
      dark: '/assets/gameStore.png',
      light: '/assets/gameStore.png',
      alt: {
        dark: 'Game Store storefront showing a featured game hero and the available games grid',
        light: 'Game Store storefront showing a featured game hero and the available games grid',
      },
    },
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
    img: {
      dark: '/assets/portfolio_dark_mode.png',
      light: '/assets/portfolio_light_mode.png',
      alt: {
        dark: 'Portfolio website in dark mode',
        light: 'Portfolio website in light mode',
      },
    },
  },
] as const;

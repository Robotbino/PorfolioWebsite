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
  readonly img: ProjectImage;
}

export const EXPERIENCE_GROUPS: readonly ExperienceGroup[] = [
  {
    label: 'Programming Languages',
    description: 'Java, JavaScript, React, Angular, Data Structures',
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
    description: 'Agile, Waterfall, Systems Development Life Cycle',
  },
  {
    label: 'Other Skills',
    description: 'Data Collection, Data Modelling and Data Visualization',
  },
] as const;

export const PROJECTS: readonly Project[] = [
  {
    title: 'Memory Leak',
    description:
      'An interactive memory card game built with Angular featuring themed cards, ' +
      'score tracking, and attempt limits. Players flip cards to find matching pairs ' +
      'while racing against their remaining attempts.',
    tech: ['Angular', 'JavaScript', 'CSS3', 'HTML5'],
    href: 'https://github.com/Robotbino/CodePairs.git',
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
    title: 'Employee Manager',
    description:
      'A full-stack employee management system with Spring Boot backend and Angular ' +
      'frontend. Features JWT authentication, CRUD operations, and MySQL database ' +
      'integration for secure employee data management.',
    tech: ['Spring Boot', 'Angular', 'MySQL', 'JWT'],
    href: 'https://github.com/Robotbino/EmployeeManager-Application.git',
    img: {
      dark: '/assets/EmployeeManagerInterface.jpg',
      light: '/assets/EmployeeManagerInterface.jpg',
      alt: {
        dark: 'Employee Manager dashboard interface',
        light: 'Employee Manager dashboard interface',
      },
    },
  },
  {
    title: 'Portfolio Website',
    description:
      'The site you are viewing — an Angular single-page app built as one continuous ' +
      'scroll: a cycle through four destinations that loops back on itself'+
      'The star-map and aurora behind the text run on a single shared ' +
      'frame loop, with the constellation morphing between three different shapes as you scroll.', 
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

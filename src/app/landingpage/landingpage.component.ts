import { Component, OnInit, OnDestroy, AfterViewInit, NgZone } from '@angular/core';

@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css'
})
export class LandingpageComponent implements OnInit, OnDestroy, AfterViewInit {

  constructor(private ngZone: NgZone) {}

  private link = document.createElement('a');
  private darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  private isDarkMode = this.darkModeMediaQuery.matches;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private hasManualOverride = false;

  // Typewriter state
  public displayedTitle = '';
  private fullTitle = 'Full-Stack Developer';
  private typewriterIndex = 0;
  private typewriterTimer: ReturnType<typeof setTimeout> | null = null;
  public isTypingDone = false;

  // Observers
  private revealObserver: IntersectionObserver | null = null;
  private navObserver: IntersectionObserver | null = null;
  private checkmarkObserver: IntersectionObserver | null = null;
  private scrollListener: (() => void) | null = null;
  private magneticCleanup: (() => void)[] = [];


  // ── Lifecycle ────────────────────────────────────────────────

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
      this.hasManualOverride = true;
    } else {
      this.isDarkMode = this.darkModeMediaQuery.matches;
    }

    this.updateTheme();

    this.mediaQueryListener = (e: MediaQueryListEvent) => {
      if (!this.hasManualOverride) {
        this.isDarkMode = e.matches;
        this.updateTheme();
      }
    };
    this.darkModeMediaQuery.addEventListener('change', this.mediaQueryListener);
  }

  ngAfterViewInit(): void {
    this.initScrollProgress();
    this.initRevealObserver();
    this.initNavObserver();
    this.initCheckmarkAnimation();
    this.initMagneticButtons();
    this.startTypewriter();
  }

  ngOnDestroy(): void {
    if (this.mediaQueryListener) {
      this.darkModeMediaQuery.removeEventListener('change', this.mediaQueryListener);
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
    if (this.typewriterTimer) clearTimeout(this.typewriterTimer);
    this.revealObserver?.disconnect();
    this.navObserver?.disconnect();
    this.checkmarkObserver?.disconnect();
    this.magneticCleanup.forEach(fn => fn());
  }


  // ── Theme ────────────────────────────────────────────────────

  private updateTheme(): void {
    document.documentElement.classList.toggle('dark-mode', this.isDarkMode);
  }

  public toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.hasManualOverride = true;
    this.updateTheme();
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
  }

  public get currentTheme(): string {
    return this.isDarkMode ? 'dark' : 'light';
  }

  public get isDarkModeActive(): boolean {
    return this.isDarkMode;
  }


  // ── CV Download ──────────────────────────────────────────────

  public downloadCV(): void {
    this.link.href = 'assets/HlongwanaBinoCV.pdf';
    this.link.download = 'BHlongwanaBinoCV.pdf';
    this.link.click();
  }


  // ── Portfolio image ──────────────────────────────────────────

  public get portfolioImageSrc(): string {
    return this.isDarkMode
      ? '/assets/portfolio_light_mode.png'
      : '/assets/portfolio_dark_mode.png';
  }

  public get portfolioImageAlt(): string {
    return this.isDarkMode
      ? 'Portfolio website in light mode'
      : 'Portfolio website in dark mode';
  }


  // ── Scroll progress bar + nav shadow ────────────────────────

  private initScrollProgress(): void {
    this.ngZone.runOutsideAngular(() => {
      const bar = document.querySelector('.scroll-progress') as HTMLElement | null;
      const header = document.getElementById('header');

      const update = () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (bar) {
          bar.style.width = docHeight > 0 ? `${(scrollTop / docHeight) * 100}%` : '0%';
        }
        header?.classList.toggle('scrolled', scrollTop > 10);
      };

      this.scrollListener = update;
      window.addEventListener('scroll', update, { passive: true });
    });
  }


  // ── Scroll reveal (IntersectionObserver) ────────────────────

  private initRevealObserver(): void {
    this.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            this.revealObserver!.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll('.reveal').forEach(el => {
      this.revealObserver!.observe(el);
    });
  }


  // ── Active nav link tracking ─────────────────────────────────

  private initNavObserver(): void {
    const sectionIds = ['about', 'experience', 'projects', 'contact'];

    this.navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            document.querySelectorAll('.nav-link').forEach(link => {
              const isActive = link.getAttribute('href') === `#${entry.target.id}`;
              link.classList.toggle('active', isActive);
            });
          }
        });
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );

    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) this.navObserver!.observe(el);
    });
  }


  // ── Typewriter ───────────────────────────────────────────────

  private startTypewriter(): void {
    // Small initial delay so the hero fade-in settles first
    setTimeout(() => this.typeNext(), 600);
  }

  private typeNext(): void {
    if (this.typewriterIndex < this.fullTitle.length) {
      this.displayedTitle += this.fullTitle[this.typewriterIndex];
      this.typewriterIndex++;
      // Vary speed slightly for a natural feel
      const delay = this.typewriterIndex % 3 === 0 ? 110 : 75;
      this.typewriterTimer = setTimeout(() => this.typeNext(), delay);
    } else {
      this.isTypingDone = true;
    }
  }


  // ── Magnetic hover on buttons ────────────────────────────────

  private initMagneticButtons(): void {
    this.ngZone.runOutsideAngular(() => {
      document.querySelectorAll('.btn').forEach(btn => {
        const el = btn as HTMLElement;

        const onMove = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const x = (e.clientX - rect.left - rect.width / 2) * 0.18;
          const y = (e.clientY - rect.top - rect.height / 2) * 0.18;
          el.style.transform = `translate(${x}px, ${y}px) translateY(-2px)`;
        };

        const onLeave = () => {
          el.style.transform = '';
        };

        el.addEventListener('mousemove', onMove);
        el.addEventListener('mouseleave', onLeave);

        // Track cleanup
        this.magneticCleanup.push(() => {
          el.removeEventListener('mousemove', onMove);
          el.removeEventListener('mouseleave', onLeave);
        });
      });
    });
  }


  // ── Checkmark stagger pop ────────────────────────────────────

  private initCheckmarkAnimation(): void {
    const section = document.getElementById('experience');
    if (!section) return;

    this.checkmarkObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          document.querySelectorAll('.checkmark').forEach((el, i) => {
            setTimeout(() => el.classList.add('pop'), i * 70);
          });
          this.checkmarkObserver!.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    this.checkmarkObserver.observe(section);
  }
}
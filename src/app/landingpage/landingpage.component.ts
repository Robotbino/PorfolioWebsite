import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';


@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css'
})
export class LandingpageComponent implements OnInit,OnDestroy {


  constructor() {}
  private link = document.createElement('a');
  public isScrolled = false;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > 24;
  }

  private darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  private isDarkMode = this.darkModeMediaQuery.matches;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private hasManualOverride = false; // Track if user has manually set a preference


  ngOnInit(): void {
    // Check for saved theme preference
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
    this.darkModeMediaQuery.addEventListener("change", this.mediaQueryListener);
  }

  ngOnDestroy(): void {
    // Clean up event listener
    if (this.mediaQueryListener) {
      this.darkModeMediaQuery.removeEventListener("change", this.mediaQueryListener);
    }
  }

  private updateTheme(): void {
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
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

  public downloadCV(): void {
    console.log("Downloading CV...");
    this.link.href = 'assets/Bino_FullStack_CV_April2026.pdf';
    this.link.download = 'Bino_FullStack_CV_April2026.pdf';
    this.link.click();
  } 

  public get portfolioImageSrc(): string {
    return this.isDarkMode
      ? '/assets/portfolio_dark_mode.png'
      : '/assets/portfolio_light_mode.png';
  }

  public get portfolioImageAlt(): string {
    return this.isDarkMode
      ? 'Portfolio website in dark mode'
      : 'Portfolio website in light mode';
  }

}

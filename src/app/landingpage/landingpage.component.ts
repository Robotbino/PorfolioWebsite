import { Component, OnInit, OnDestroy  } from '@angular/core';


@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css'
})
export class LandingpageComponent implements OnInit,OnDestroy {


  constructor() {}
  private link = document.createElement('a');
  private darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  private isDarkMode = this.darkModeMediaQuery.matches;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;


  ngOnInit(): void {
      this.mediaQueryListener = (e: MediaQueryListEvent) => {
      this.isDarkMode = e.matches;
      this.updateTheme();
    };
    
    this.darkModeMediaQuery.addEventListener("change", this.mediaQueryListener);
    this.updateTheme();
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
      this.applyManualTheme();
    }
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

  
  private applyManualTheme(): void {
    document.documentElement.classList.toggle('dark-mode', this.isDarkMode);
  }

 
  public toggleTheme(): void {
    console.log(this.isDarkMode)
    this.isDarkMode = !this.isDarkMode;
    this.applyManualTheme();
    
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
    this.link.href = 'assets/BinoHlongwanaATS-CV.pdf';
    this.link.download = 'BinoHlongwanaATS-CV.pdf';
    this.link.click();
  } 
}

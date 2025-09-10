import { Component } from '@angular/core';
import { AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css'
})
export class LandingpageComponent {
 backgroundImage = 'assets/gradient.png';

 visibleSections = new Set<string>();
 private observer!: IntersectionObserver;

  ngAfterViewInit(): void {
    this.setupScrollObserver();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupScrollObserver(): void {
    // Simple observer options - triggers when 50% of section is visible
    const options = {
      root: null,
      threshold: 0.5,
      rootMargin: '0px'
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const sectionId = entry.target.id;
        
        if (entry.isIntersecting) {
          // Add fade-in animation
          entry.target.classList.add('is-visible');
          // Update navigation highlight
          this.visibleSections.add(sectionId);
        } else {
          // Remove from navigation highlight when not visible
          this.visibleSections.delete(sectionId);
        }
      });
    }, options);

    // Watch all sections
    const sections = document.querySelectorAll('.content section');
    sections.forEach(section => {
      this.observer.observe(section);
    });
  }

  scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    
    const section = document.getElementById(sectionId);
    if (section) {
      // Simple smooth scroll with small offset for navigation bar
      const yOffset = -80; // Adjust this value based on your nav bar height
      const elementTop = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
      
      window.scrollTo({
        top: elementTop,
        behavior: 'smooth'
      });
    }
  }

  // Simple helper method to check if section is active
  isSectionActive(sectionId: string): boolean {
    return this.visibleSections.has(sectionId);
  }
}

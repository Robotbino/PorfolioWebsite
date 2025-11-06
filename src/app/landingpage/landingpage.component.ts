import { Component } from '@angular/core';


@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css'
})
export class LandingpageComponent {
  private darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  private darkMode = this.darkModeMediaQuery.matches;

  constructor() {
    this.darkModeMediaQuery.addEventListener("change", (e) => {
      if (e.matches) {
        this.darkMode = true;
      } else {
        this.darkMode = false;
      }
    });
  }
}

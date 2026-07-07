import { Component } from '@angular/core';

@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css',
})
export class LandingpageComponent {
  private link = document.createElement('a');


  // ── CV Download ──────────────────────────────────────────────

  public downloadCV(): void {
    this.link.href = 'assets/Bino_Hlongwana_CV_2026.pdf';
    this.link.download = 'Bino_Hlongwana_CV_2026.pdf';
    this.link.click();
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-landingpage',
  standalone: false,
  templateUrl: './landingpage.component.html',
  styleUrl: './landingpage.component.css',
})
export class LandingpageComponent implements OnInit, OnDestroy {
  private link = document.createElement('a');

  /** Bino's local wall-clock (SAST is fixed UTC+2, but the IANA zone keeps it
   *  honest), riding the hero's coords so a visitor knows when to expect a reply. */
  localTime = '';
  private clockTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.tickClock();
  }

  /** Minute-precision display, so wake exactly on the minute flip instead of
   *  polling — one timer a minute is all the hero clock costs. */
  private tickClock(): void {
    this.localTime = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Johannesburg',
    }).format(new Date());
    const msToNextMinute = 60_000 - (Date.now() % 60_000) + 250;
    this.clockTimer = setTimeout(() => this.tickClock(), msToNextMinute);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearTimeout(this.clockTimer);
    }
  }

  // ── CV Download ──────────────────────────────────────────────

  public downloadCV(): void {
    this.link.href = 'assets/Bino_Hlongwana_CV_2026.pdf';
    this.link.download = 'Bino_Hlongwana_CV_2026.pdf';
    this.link.click();
  }
}

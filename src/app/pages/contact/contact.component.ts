import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-contact',
  standalone: false,
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css',
})
export class ContactComponent implements OnInit, OnDestroy {
  /** Drives the email row's "Copy → Copied" swap; reverts after a beat. */
  copied = false;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  /** Colophon sign-off — computed so the footer never goes stale. */
  readonly year = new Date().getFullYear();

  /** Bino's local wall-clock (SAST is fixed UTC+2, but the IANA zone keeps it
   *  honest), shown in the colophon so a visitor knows when to expect a reply. */
  localTime = '';
  private clockTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.tickClock();
  }

  async copyEmail(email: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Clipboard unavailable (insecure context or denied permission) — the
      // mailto link beside the button is the always-working fallback.
      return;
    }
    this.copied = true;
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    this.resetTimer = setTimeout(() => (this.copied = false), 2000);
  }

  /** Minute-precision display, so wake exactly on the minute flip instead of
   *  polling — one timer a minute is all the colophon clock costs. */
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
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    if (this.clockTimer) {
      clearTimeout(this.clockTimer);
    }
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-contact',
  standalone: false,
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css',
})
export class ContactComponent implements OnInit, OnDestroy {

  copied = false;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bino's local wall-clock (SAST is fixed UTC+2, but the IANA zone keeps it
   *  honest), shown in the colophon so a visitor knows when to expect a reply. */
  localTime = '';
  private clockTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    
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

 

  ngOnDestroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    if (this.clockTimer) {
      clearTimeout(this.clockTimer);
    }
  }
}

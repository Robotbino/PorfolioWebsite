import { Component, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-contact',
  standalone: false,
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css',
})
export class ContactComponent implements OnDestroy {
  /** Drives the email row's "Copy → Copied" swap; reverts after a beat. */
  copied = false;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

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
  }
}

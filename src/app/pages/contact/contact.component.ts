import { Component, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-contact',
  standalone: false,
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css',
})
export class ContactComponent implements OnDestroy {
  copied = false;

  /**
   * Announced by the live region beside the button. The swapped `aria-label`
   * alone was not enough: relabelling the element that already has focus is
   * announced inconsistently across screen readers, and a silent failure told
   * a non-sighted visitor nothing at all.
   */
  copyStatus = '';

  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  async copyEmail(email: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Clipboard unavailable (insecure context or denied permission) — the
      // mailto link beside the button is the always-working fallback, so say
      // so rather than appearing to do nothing.
      this.copyStatus = `Copy failed. The address is ${email}.`;
      return;
    }
    this.copied = true;
    this.copyStatus = 'Email address copied to clipboard.';
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    this.resetTimer = setTimeout(() => {
      this.copied = false;
      this.copyStatus = '';
    }, 2000);
  }

  ngOnDestroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
  }
}

import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
import { ScrollRevealDirective } from '../../scroll-reveal.directive';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css',
  imports: [ScrollRevealDirective, IconComponent],
})
export class ContactComponent implements OnDestroy {
  /** The colophon's copyright year, read from the clock rather than hard-coded. */
  readonly year = new Date().getFullYear();

  // Signals, not plain fields: both change AFTER an await and again from a
  // timeout, neither of which is an event on this component's own template. A
  // signal read in the template marks the view dirty itself, which is what makes
  // that safe under OnPush.
  readonly copied = signal(false);

  /**
   * Announced by the live region beside the button. The swapped `aria-label`
   * alone was not enough: relabelling the element that already has focus is
   * announced inconsistently across screen readers, and a silent failure told
   * a non-sighted visitor nothing at all.
   */
  readonly copyStatus = signal('');

  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  async copyEmail(email: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Clipboard unavailable (insecure context or denied permission) — the
      // mailto link beside the button is the always-working fallback, so say
      // so rather than appearing to do nothing.
      this.copyStatus.set(`Copy failed. The address is ${email}.`);
      return;
    }
    this.copied.set(true);
    this.copyStatus.set('Email address copied to clipboard.');
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    this.resetTimer = setTimeout(() => {
      this.copied.set(false);
      this.copyStatus.set('');
    }, 2000);
  }

  ngOnDestroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
  }
}

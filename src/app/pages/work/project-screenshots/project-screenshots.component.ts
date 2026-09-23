import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ThemeService } from '../../../core/theme.service';
import { MotionSettingsService } from '../../../core/motion-settings.service';
import { InViewportService } from '../../../core/in-viewport.service';
import { ProjectImage } from '../work-data';

/**
 * A project card's screenshots. One screenshot renders as a plain image; more
 * than one become a slideshow that crossfades between them, with a caption
 * naming the page on show and a button per screenshot.
 *
 * The timer is the active button's progress bar: a CSS animation whose end
 * brings up the next screenshot. Keeping the timing in CSS means every pause
 * (hover, keyboard focus, card off screen) is one `animation-play-state` rule,
 * so the bar and the timer can never disagree, and nothing ticks in JavaScript.
 * It never runs under reduced motion and stops for good once the visitor picks
 * a screenshot themselves.
 */
@Component({
  selector: 'app-project-screenshots',
  templateUrl: './project-screenshots.component.html',
  styleUrl: './project-screenshots.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectScreenshotsComponent implements OnInit, OnDestroy {
  private theme = inject(ThemeService);
  private motion = inject(MotionSettingsService);
  private inView = inject(InViewportService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly screenshots = input.required<readonly ProjectImage[]>();
  /** The project's name, for the controls' accessible label. */
  readonly projectTitle = input.required<string>();

  readonly active = signal(0);
  /** Set once the visitor picks a screenshot: from then on they are in control. */
  private readonly chosen = signal(false);

  readonly isSlideshow = computed(() => this.screenshots().length > 1);
  readonly autoplay = computed(
    () => this.isSlideshow() && !this.chosen() && !this.motion.reducedMotion(),
  );

  private release?: () => void;

  ngOnInit(): void {
    if (!this.isSlideshow()) {
      return;
    }
    // Off screen the bar pauses rather than resets, so a card scrolled past
    // mid-screenshot picks up where it left off. A class toggled straight on
    // the host: a viewport crossing never needs change detection.
    const host = this.host.nativeElement;
    this.release = this.inView.observe(host, { threshold: 0.5 }, (visible) =>
      host.classList.toggle('is-offscreen', !visible),
    );
  }

  src(shot: ProjectImage): string {
    return this.theme.themeAsset(shot.dark, shot.light);
  }

  alt(shot: ProjectImage): string {
    return this.theme.themeAsset(shot.alt.dark, shot.alt.light);
  }

  label(shot: ProjectImage, index: number): string {
    return shot.label ?? `screenshot ${index + 1}`;
  }

  show(index: number): void {
    this.chosen.set(true);
    this.active.set(index);
  }

  /** The active bar ran out: bring up the next screenshot. */
  advance(index: number): void {
    // Switching reduced motion on mid-bar shortens the running animation to
    // 0.01ms (the global kill-switch in styles.css), which ends it at once.
    // Re-checking here keeps that from counting as a finished screenshot.
    if (index !== this.active() || !this.autoplay()) {
      return;
    }
    this.active.set((index + 1) % this.screenshots().length);
  }

  ngOnDestroy(): void {
    this.release?.();
  }
}

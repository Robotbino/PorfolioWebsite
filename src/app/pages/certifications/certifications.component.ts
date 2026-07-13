import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { FramePulseService } from '../../core/frame-pulse.service';
import { ScrollLockService } from '../../core/scroll-lock.service';
import { smoothingK } from '../../motion.math';
import { CERTIFICATIONS, Certification } from './certifications-data';
import {
  easeOutCubic,
  flipTransform,
  maskScales,
  tiltFromVelocity,
} from './certifications.math';

/**
 * Certifications — the loop's fifth destination. A typographic ledger (the
 * Experience index idiom) whose rows do two things: hovering a row tethers a
 * live preview of the certificate to the cursor, and clicking opens it full
 * size in the spotlight dialog (which the cursor preview FLIP-morphs into).
 * Each row keeps its Verify link to the issuer's public record.
 *
 * All per-frame motion is transform/opacity written imperatively on the shared
 * FramePulseService tick (outside Angular), so nothing here competes with the
 * WebGL aurora for frame budget; the math lives in certifications.math.ts.
 *
 * Fail-open: without hover + fine pointer (touch) or with reduced motion the
 * cursor tether never arms — rows show a static thumbnail chip and the
 * spotlight (tap to open) carries the full certificate instead.
 */
@Component({
  selector: 'app-certifications',
  standalone: false,
  templateUrl: './certifications.component.html',
  styleUrl: './certifications.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('preview') private previewRef?: ElementRef<HTMLElement>;
  @ViewChild('tilt') private tiltRef?: ElementRef<HTMLElement>;
  @ViewChild('mask') private maskRef?: ElementRef<HTMLElement>;
  @ViewChild('unmask') private unmaskRef?: ElementRef<HTMLElement>;
  @ViewChild('certList') private listRef?: ElementRef<HTMLElement>;
  @ViewChild('spotlight') private spotlightRef?: ElementRef<HTMLElement>;
  @ViewChild('spotFrame') private spotFrameRef?: ElementRef<HTMLElement>;
  @ViewChild('spotImg') private spotImgRef?: ElementRef<HTMLImageElement>;
  @ViewChild('spotTitle') private spotTitleRef?: ElementRef<HTMLElement>;
  @ViewChild('spotMeta') private spotMetaRef?: ElementRef<HTMLElement>;
  @ViewChild('spotVerify') private spotVerifyRef?: ElementRef<HTMLAnchorElement>;
  @ViewChild('spotClose') private spotCloseRef?: ElementRef<HTMLButtonElement>;

  readonly certifications: readonly Certification[] = CERTIFICATIONS;

  /** Renders the preview <img> stack only once the section approaches the
   *  viewport, so the five certificates never compete with LCP. */
  readonly armed = signal(false);
  readonly activeIndex = signal(-1);

  private enabled = false;
  private io?: IntersectionObserver;
  private unsub: (() => void) | null = null;

  // Cursor tether state — targets set by events, rendered values by the tick.
  private targetX = 0;
  private targetY = 0;
  private x = 0;
  private y = 0;
  private vx = 0; // smoothed px/ms, drives the tilt
  private targetOpen = 0;
  private progress = 0;
  private shown = false;

  // Spotlight state — the dialog is driven imperatively (no change detection).
  private spotTimer: number | null = null;
  private lastTrigger: HTMLElement | null = null;
  private suppressNextFocus = false;

  // Held while the spotlight is open; releasing it lets the shared lock go.
  private spotlockRelease: (() => void) | null = null;

  constructor(
    private zone: NgZone,
    private pulse: FramePulseService,
    private host: ElementRef<HTMLElement>,
    private scrollLock: ScrollLockService,
  ) {}

  ngAfterViewInit(): void {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hoverFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.enabled = hoverFine && !reduce;

    // Arm (one-shot) when the section is within half a viewport: the preview
    // images start fetching before the first possible hover, not at page load.
    this.io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this.zone.run(() => this.armed.set(true));
          this.io?.disconnect();
        }
      },
      { rootMargin: '50% 0px' },
    );
    this.io.observe(this.host.nativeElement);

    if (this.enabled) {
      // Coordinates only — the tick does every style write.
      this.zone.runOutsideAngular(() => {
        this.host.nativeElement.addEventListener('pointermove', this.onPointerMove, {
          passive: true,
        });
      });
    }
  }

  onRowEnter(index: number): void {
    if (!this.enabled) {
      return;
    }
    this.open(index);
  }

  /** Keyboard path: pin the preview beside the focused row (no cursor to follow). */
  onRowFocus(index: number, event: FocusEvent): void {
    // Focus restored by a closing spotlight shouldn't instantly re-summon the
    // preview the user just dismissed.
    if (this.suppressNextFocus) {
      this.suppressNextFocus = false;
      return;
    }
    if (!this.enabled) {
      return;
    }
    const row = event.currentTarget as HTMLElement;
    const rect = row.getBoundingClientRect(); // event-time read, never in the tick
    this.setTarget(rect.right, rect.top + rect.height / 2);
    this.open(index);
  }

  onListLeave(): void {
    this.close();
  }

  onListFocusOut(event: FocusEvent): void {
    const list = this.listRef?.nativeElement;
    if (list && !list.contains(event.relatedTarget as Node | null)) {
      this.close();
    }
  }

  /**
   * Open the spotlight: fill the dialog imperatively, then FLIP the frame from
   * the live cursor preview (or the row's touch chip) to its resting place, so
   * the certificate appears to grow out of the tease instead of popping in.
   * All reads happen here at event time — never in the tick. Not gated by
   * `enabled`: touch and reduced-motion users reach the certificate this way.
   */
  openSpotlight(index: number, event: Event): void {
    const root = this.spotlightRef?.nativeElement;
    const frame = this.spotFrameRef?.nativeElement;
    const img = this.spotImgRef?.nativeElement;
    if (!root || !frame || !img) {
      return;
    }
    const cert = this.certifications[index];
    this.lastTrigger = event.currentTarget as HTMLElement;

    // Reopening during a close animation: cancel the pending teardown.
    if (this.spotTimer !== null) {
      clearTimeout(this.spotTimer);
      this.spotTimer = null;
      root.classList.remove('is-closing');
    }

    img.src = cert.img;
    img.alt = cert.alt;
    if (this.spotTitleRef) {
      this.spotTitleRef.nativeElement.textContent = cert.title;
    }
    if (this.spotMetaRef) {
      this.spotMetaRef.nativeElement.textContent = cert.issuer;
    }
    if (this.spotVerifyRef) {
      const verify = this.spotVerifyRef.nativeElement;
      verify.href = cert.href;
      verify.setAttribute('aria-label', 'Verify ' + cert.title + ' certificate (opens in new tab)');
    }
    root.setAttribute('aria-label', cert.title);

    // FLIP source: the cursor preview if it's up, else the row's touch chip.
    const tiltEl = this.tiltRef?.nativeElement;
    const chip = this.lastTrigger?.querySelector<HTMLElement>('.certs-thumb');
    const srcEl = this.shown && tiltEl ? tiltEl : chip && chip.offsetParent !== null ? chip : null;
    const srcRect = srcEl?.getBoundingClientRect();

    // The tease has done its job — shut it behind the spotlight.
    this.close();

    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    // Acquire the shared scroll lock; release it when closing.
    this.spotlockRelease = this.scrollLock.acquire();
    this.zone.runOutsideAngular(() => {
      document.addEventListener('keydown', this.onSpotlightDocKeydown);
    });

    // Measure the frame at rest, place it on the source, then release: the
    // transition carries it back to identity (reduced motion collapses this
    // to an instant cut via the global rule).
    frame.style.transition = 'none';
    frame.style.transform = 'none';
    const dstRect = frame.getBoundingClientRect();
    const dst = { x: dstRect.x, y: dstRect.y, w: dstRect.width, h: dstRect.height };
    const hasSource = !!srcRect && srcRect.width > 0 && srcRect.height > 0;
    const from = hasSource
      ? { x: srcRect!.x, y: srcRect!.y, w: srcRect!.width, h: srcRect!.height }
      : // No visible source (e.g. keyboard before any preview): grow from centre.
        { x: dst.x + dst.w * 0.03, y: dst.y + dst.h * 0.03, w: dst.w * 0.94, h: dst.h * 0.94 };
    const f = flipTransform(from, dst);
    frame.style.transformOrigin = '0 0';
    frame.style.transform = `translate3d(${f.tx.toFixed(2)}px, ${f.ty.toFixed(2)}px, 0) scale(${f.sx.toFixed(4)}, ${f.sy.toFixed(4)})`;
    if (!hasSource) {
      frame.style.opacity = '0';
    }
    void frame.offsetWidth; // commit the start state
    frame.style.transition = '';
    frame.style.transform = '';
    frame.style.opacity = '';

    this.spotCloseRef?.nativeElement.focus();
  }

  closeSpotlight(): void {
    const root = this.spotlightRef?.nativeElement;
    const frame = this.spotFrameRef?.nativeElement;
    if (!root || !root.classList.contains('is-open')) {
      return;
    }
    root.classList.remove('is-open');
    root.classList.add('is-closing');
    root.setAttribute('aria-hidden', 'true');
    if (frame) {
      frame.style.transformOrigin = '';
      frame.style.transform = 'scale(0.97)';
      frame.style.opacity = '0';
    }
    document.removeEventListener('keydown', this.onSpotlightDocKeydown);
    this.spotlockRelease?.();
    this.spotlockRelease = null;

    // Let the exit fade finish before hiding, then clear the inline styles so
    // the next open starts clean.
    this.zone.runOutsideAngular(() => {
      this.spotTimer = window.setTimeout(() => {
        this.spotTimer = null;
        root.classList.remove('is-closing');
        if (frame) {
          frame.style.transform = '';
          frame.style.opacity = '';
        }
      }, 320);
    });

    this.suppressNextFocus = true;
    this.lastTrigger?.focus();
    this.lastTrigger = null;
  }

  /** Focus trap: Tab cycles between the Verify link and the Close button (the
   *  dialog's only two controls, in DOM order). */
  onSpotlightKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const first = this.spotVerifyRef?.nativeElement;
    const last = this.spotCloseRef?.nativeElement;
    if (!first || !last) {
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Esc must work even if a click moved focus off the trapped controls. */
  private onSpotlightDocKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.zone.run(() => this.closeSpotlight());
    }
  };

  private open(index: number): void {
    // Row switch while open: partially re-fire the shutter (a "blink") so the
    // new certificate gets its own reveal beat instead of a bare crossfade.
    if (this.shown && index !== this.activeIndex()) {
      this.progress = Math.min(this.progress, 0.6);
    }
    this.activeIndex.set(index);
    this.targetOpen = 1;
    if (!this.shown) {
      // First appearance: snap to the target so the preview doesn't fly in
      // from a stale corner.
      this.x = this.targetX;
      this.y = this.targetY;
      this.shown = true;
      this.previewRef?.nativeElement.classList.add('is-on');
    }
    this.ensureLoop();
  }

  private close(): void {
    this.activeIndex.set(-1);
    this.targetOpen = 0;
  }

  private onPointerMove = (event: PointerEvent): void => {
    this.setTarget(event.clientX, event.clientY);
  };

  /**
   * Clamp the tether target so the (centre-anchored) preview never hangs off
   * the viewport. Half-size is derived from the same formula as the CSS
   * (width: min(30rem, 36vw), aspect 3/2) — arithmetic only, no DOM reads.
   */
  private setTarget(x: number, y: number): void {
    const halfW = Math.min(480, window.innerWidth * 0.36) / 2;
    const halfH = (halfW * 2) / 3;
    const margin = 16;
    this.targetX = Math.max(halfW + margin, Math.min(window.innerWidth - halfW - margin, x));
    this.targetY = Math.max(halfH + margin, Math.min(window.innerHeight - halfH - margin, y));
  }

  private ensureLoop(): void {
    if (!this.unsub) {
      this.unsub = this.pulse.onTick(this.tick);
    }
  }

  /** Write-only: no layout reads, transform/opacity writes only. */
  private tick = (_now: number, dt: number): void => {
    const preview = this.previewRef?.nativeElement;
    const tilt = this.tiltRef?.nativeElement;
    const mask = this.maskRef?.nativeElement;
    const unmask = this.unmaskRef?.nativeElement;
    if (!preview || !tilt || !mask || !unmask) {
      return;
    }

    const kPos = smoothingK(dt, 0.16);
    const prevX = this.x;
    this.x += (this.targetX - this.x) * kPos;
    this.y += (this.targetY - this.y) * kPos;

    // Velocity of the *rendered* position, so the tilt swings with the tether
    // (already smoothed) instead of jittering with raw pointer deltas.
    const instVx = dt > 0 ? (this.x - prevX) / dt : 0;
    this.vx += (instVx - this.vx) * smoothingK(dt, 0.1);

    const kOpen = smoothingK(dt, this.targetOpen === 1 ? 0.14 : 0.18);
    this.progress += (this.targetOpen - this.progress) * kOpen;

    const eased = easeOutCubic(this.progress);
    const { outer, inner } = maskScales(eased);
    const rot = tiltFromVelocity(this.vx);
    const settle = 0.9 + 0.1 * eased;

    preview.style.transform = `translate3d(${this.x.toFixed(2)}px, ${this.y.toFixed(2)}px, 0)`;
    preview.style.opacity = Math.min(1, eased * 3).toFixed(3);
    tilt.style.transform = `translate(-50%, -50%) rotate(${rot.toFixed(2)}deg) scale(${settle.toFixed(3)})`;
    mask.style.transform = `scaleY(${outer.toFixed(4)})`;
    unmask.style.transform = `scaleY(${inner.toFixed(4)})`;

    // Fully shut and idle: release the shared rAF so the loop costs nothing
    // between hovers (the aurora keeps its whole frame budget), and rest the
    // layers at identity — a dormant counter-scaled unmask would otherwise
    // hold an enormous composited layer for nothing.
    if (this.targetOpen === 0 && this.progress < 0.005) {
      this.progress = 0;
      this.shown = false;
      preview.classList.remove('is-on');
      preview.style.opacity = '0';
      mask.style.transform = 'scaleY(1)';
      unmask.style.transform = 'scaleY(1)';
      this.unsub?.();
      this.unsub = null;
    }
  };

  ngOnDestroy(): void {
    this.unsub?.();
    this.io?.disconnect();
    this.host.nativeElement.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('keydown', this.onSpotlightDocKeydown);
    if (this.spotTimer !== null) {
      clearTimeout(this.spotTimer);
    }
    // If destroyed with the spotlight open, release its hold on the scroll lock.
    this.spotlockRelease?.();
    this.spotlockRelease = null;
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { InViewportService } from '../../../core/in-viewport.service';

/** One orbiting tool: its logo, which ring it rides, and where on that ring it starts. */
export interface OrbitTool {
  readonly name: string;
  readonly src: string;
  /** Intrinsic size of the exported logo, so the browser knows its ratio before it loads. */
  readonly width: number;
  readonly height: number;
  readonly ring: 'inner' | 'outer';
  /** Starting position as a fraction of a lap (0…1), counted counter-clockwise. */
  readonly slot: number;
  /**
   * Optical size correction. The logos are edge-to-edge in their canvases, so a
   * full-bleed circle (Postman) reads larger than a thin outline (MySQL) at the
   * same box size; these factors make all ten read as one size.
   */
  readonly fit: number;
}

const ICON = '/assets/toolset/';

/**
 * Four on the inner ring and six on the outer: the counts match the two rings'
 * circumferences, so neighbours sit about the same distance apart on both.
 * Warm and cool logos alternate around each ring.
 */
export const ORBIT_TOOLS: readonly OrbitTool[] = [
  {
    name: 'Claude',
    src: `${ICON}claude.webp`,
    width: 64,
    height: 64,
    ring: 'inner',
    slot: 0.125,
    fit: 0.94,
  },
  {
    name: 'Visual Studio Code',
    src: `${ICON}vscode.webp`,
    width: 64,
    height: 64,
    ring: 'inner',
    slot: 0.375,
    fit: 0.92,
  },
  {
    name: 'Git',
    src: `${ICON}git.webp`,
    width: 64,
    height: 64,
    ring: 'inner',
    slot: 0.625,
    fit: 1,
  },
  {
    name: 'Obsidian',
    src: `${ICON}obsidian.webp`,
    width: 50,
    height: 64,
    ring: 'inner',
    slot: 0.875,
    fit: 1,
  },
  {
    name: 'Postman',
    src: `${ICON}postman.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 0,
    fit: 0.88,
  },
  {
    name: 'PostgreSQL',
    src: `${ICON}postgresql.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 1 / 6,
    fit: 0.92,
  },
  {
    name: 'Figma',
    src: `${ICON}figma.webp`,
    width: 43,
    height: 64,
    ring: 'outer',
    slot: 2 / 6,
    fit: 1,
  },
  {
    name: 'MySQL',
    src: `${ICON}mysql.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 3 / 6,
    fit: 1.12,
  },
  {
    name: 'IntelliJ IDEA',
    src: `${ICON}intellij.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 4 / 6,
    fit: 0.88,
  },
  {
    name: 'Netlify',
    src: `${ICON}netlify.webp`,
    width: 64,
    height: 64,
    ring: 'outer',
    slot: 5 / 6,
    fit: 1,
  },
];

/**
 * The Toolset illustration: a still black hole with ten tool logos orbiting it
 * on two tilted rings. All of the motion is CSS keyframes on `transform`, so it
 * runs on the compositor with no script per frame. The only script here pauses
 * those keyframes while the illustration is off screen.
 * See docs/adr/0012-toolset-orbit.md.
 */
@Component({
  selector: 'app-tool-orbit',
  templateUrl: './tool-orbit.component.html',
  styleUrl: './tool-orbit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolOrbitComponent implements OnInit, OnDestroy {
  private inView = inject(InViewportService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tools = ORBIT_TOOLS;

  private release?: () => void;

  ngOnInit(): void {
    // A class toggled straight on the host: a viewport crossing never needs
    // change detection. Until the first callback the orbit simply runs.
    const host = this.host.nativeElement;
    this.release = this.inView.observe(host, { threshold: 0 }, (visible) =>
      host.classList.toggle('is-offscreen', !visible),
    );
  }

  ngOnDestroy(): void {
    this.release?.();
  }
}

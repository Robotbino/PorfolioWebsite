import { Injectable } from '@angular/core';

/**
 * Carries the reader's continuous scroll position, expressed in "destination"
 * units: 0 = the first figure, 1 = the second, … and it wraps (the star map
 * loops). The app shell writes it on scroll; the constellation samples it every
 * rAF frame to drive the morph.
 *
 * A plain mutable field on purpose — it is read ~60×/s from outside Angular's
 * zone, so it must not trip change detection.
 */
@Injectable({ providedIn: 'root' })
export class ScrollStageService {
  position = 0;
}

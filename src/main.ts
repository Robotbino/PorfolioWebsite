import { provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

/**
 * Standalone bootstrap: there is no NgModule and no router, so the whole
 * application graph is the shell component and what its template imports.
 *
 * `eventCoalescing` matters more here than in a typical app. The site drives
 * every animation from one out-of-zone rAF, but ordinary DOM events still tick
 * the zone; coalescing collapses a burst of them into a single change-detection
 * pass instead of one per event.
 */
bootstrapApplication(AppComponent, {
  providers: [provideZoneChangeDetection({ eventCoalescing: true })],
}).catch((err) => console.error(err));

import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: false,
  template: `
    <section class="section">
      <div class="container">
        <header class="section-header">
          <p class="section-pre-title">Get to know more</p>
          <h2 class="section-title">About Me</h2>
        </header>
        <p>Coming soon — bio and education will be carved in here.</p>
      </div>
    </section>
  `,
  styles: [`:host { display: block; position: relative; z-index: 1; min-height: 100vh; }`],
})
export class AboutComponent {}

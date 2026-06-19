import { Component } from '@angular/core';

@Component({
  selector: 'app-work',
  standalone: false,
  template: `
    <section class="section">
      <div class="container">
        <header class="section-header">
          <p class="section-pre-title">Browse My Recent</p>
          <h2 class="section-title">Work</h2>
        </header>
        <p>Coming soon — projects and skills will be carved in here.</p>
      </div>
    </section>
  `,
  styles: [`:host { display: block; position: relative; z-index: 1; min-height: 100vh; }`],
})
export class WorkComponent {}

import { Component } from '@angular/core';

@Component({
  selector: 'app-contact',
  standalone: false,
  template: `
    <section class="section">
      <div class="container">
        <header class="section-header">
          <h2 class="section-title">Contact Me</h2>
        </header>
        <p>Coming soon — contact details will be carved in here.</p>
      </div>
    </section>
  `,
  styles: [`:host { display: block; position: relative; z-index: 1; min-height: 100vh; }`],
})
export class ContactComponent {}

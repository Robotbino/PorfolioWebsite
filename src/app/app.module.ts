// shared/: stateless reusable building blocks (theme toggle, display heading)
// core/: app-wide services (theme)
// layout/: persistent shell pieces (site nav)
// pages/: routed page components (work, about, certifications, contact)
// constellation/: SVG star-map renderer + figure data
// aurora/: WebGL backdrop + CSS fallback
// landingpage/: hero / home page
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { LandingpageComponent } from './landingpage/landingpage.component';
import { AuroraComponent } from './aurora/aurora.component';
import { ConstellationComponent } from './constellation/constellation.component';
import { WorkComponent } from './pages/work/work.component';
import { AboutComponent } from './pages/about/about.component';
import { CertificationsComponent } from './pages/certifications/certifications.component';
import { ContactComponent } from './pages/contact/contact.component';
import { SiteNavComponent } from './layout/site-nav/site-nav.component';
import { ScrollRevealDirective } from './scroll-reveal.directive';
import { ThemeToggleComponent } from './shared/theme-toggle/theme-toggle.component';
import { DisplayHeadingComponent } from './shared/display-heading/display-heading.component';

@NgModule({
  declarations: [
    AppComponent,
    LandingpageComponent,
    AuroraComponent,
    ConstellationComponent,
    WorkComponent,
    AboutComponent,
    CertificationsComponent,
    ContactComponent,
    SiteNavComponent,
    ScrollRevealDirective,
    ThemeToggleComponent,
    DisplayHeadingComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

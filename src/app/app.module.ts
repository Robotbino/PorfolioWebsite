import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LandingpageComponent } from './landingpage/landingpage.component';
import { AuroraComponent } from './aurora/aurora.component';
import { ConstellationComponent } from './constellation/constellation.component';
import { WorkComponent } from './pages/work/work.component';
import { AboutComponent } from './pages/about/about.component';
import { ContactComponent } from './pages/contact/contact.component';
import { SiteNavComponent } from './layout/site-nav/site-nav.component';

@NgModule({
  declarations: [
    AppComponent,
    LandingpageComponent,
    AuroraComponent,
    ConstellationComponent,
    WorkComponent,
    AboutComponent,
    ContactComponent,
    SiteNavComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent],
  schemas: [
     CUSTOM_ELEMENTS_SCHEMA
  ] // Add any schemas if needed, e.g., CUSTOM_ELEMENTS_SCHEMA for custom elements
})
export class AppModule { }

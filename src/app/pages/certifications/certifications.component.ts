import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CERTIFICATIONS, Certification } from './certifications-data';

@Component({
  selector: 'app-certifications',
  standalone: false,
  templateUrl: './certifications.component.html',
  styleUrl: './certifications.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationsComponent {
  readonly certifications: readonly Certification[] = CERTIFICATIONS;
}

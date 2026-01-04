import {
  Directive,
  ElementRef,
  inject,
  input,
  OnInit,
  Renderer2,
} from '@angular/core';
import { DevModeService } from './devmode.service';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[devOnly]',
  standalone: true,
})
export class DevOnlyDirective implements OnInit {
  private renderer = inject(Renderer2);
  private elementRef = inject(ElementRef);
  private devModeService = inject(DevModeService);

  public devOnly = input<string>('true');
  private isDevMode = false;

  ngOnInit() {
    if (this.devOnly() === 'false') {
      this.isDevMode = false;
    } else {
      this.isDevMode = this.devModeService.isProduction;
    }
    this.toggleVisibility();
  }

  private toggleVisibility() {
    if (this.isDevMode) {
      this.renderer.setStyle(this.elementRef.nativeElement, 'display', 'block');
    } else {
      this.renderer.setStyle(this.elementRef.nativeElement, 'display', 'none');
    }
  }
}

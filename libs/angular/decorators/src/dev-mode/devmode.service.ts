import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DevModeService {
  public isProduction = false;

  public setEnvironment(isProduction: boolean) {
    this.isProduction = isProduction;
  }
}

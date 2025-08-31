import 'zone.js';  // Required for Angular change detection
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

// Helpful runtime assertion to ensure Zone.js is present in prod
declare const Zone: any;
if (typeof (Zone as any) === 'undefined') {
  console.error('Zone.js is not loaded.');
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

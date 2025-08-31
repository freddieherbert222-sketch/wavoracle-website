import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { HttpClientModule } from '@angular/common/http';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CookieService } from 'ngx-cookie-service';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { EtaPipe, SpeedPipe, EncodeURIComponent, FileSizePipe } from './downloads.pipe';
import { MasterCheckboxComponent, SlaveCheckboxComponent } from './master-checkbox.component';
import { AudioAnalysisComponent } from './audio-analysis/audio-analysis.component';
import { AudioFileSelectorComponent } from './audio-file-selector/audio-file-selector.component';
import { AIInsightsComponent } from './ai-insights/ai-insights.component';
import { CostControlComponent } from './cost-control/cost-control.component';
import { LegalDisclaimerComponent } from './legal-disclaimer/legal-disclaimer.component';
import { CosmicBackgroundComponent } from './cosmic-background/cosmic-background.component';
import { WavOracleSocket } from './wavoracle-socket';
import { NgSelectModule } from '@ng-select/ng-select';
import { WebScrapingService } from './web-scraping.service';
import { DownloadsService } from './downloads.service';
import { AudioFileHandlerService } from './audio-file-handler.service';

@NgModule({
  declarations: [
    AppComponent,
    EtaPipe,
    SpeedPipe,
    FileSizePipe,
    EncodeURIComponent,
    MasterCheckboxComponent,
    SlaveCheckboxComponent,
    AudioAnalysisComponent,
    AudioFileSelectorComponent,
    AIInsightsComponent,
    CostControlComponent,
    LegalDisclaimerComponent,
    CosmicBackgroundComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    NgbModule,
    FontAwesomeModule,
    NgSelectModule,
    RouterModule.forRoot([]),
    HttpClientModule
  ],
  providers: [
    CookieService, 
    WebScrapingService,
    DownloadsService,
    WavOracleSocket,
    AudioFileHandlerService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

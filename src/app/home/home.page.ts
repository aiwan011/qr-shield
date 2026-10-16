import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
  IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
  IonCardContent, IonList, IonListHeader, IonLabel, IonText
} from '@ionic/angular';
import { UrlCheckerService, ScanReport, Status } from '../services/url-checker.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
    IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
    IonCardContent, IonList, IonListHeader, IonLabel, IonText
  ],
})
export class HomePage implements OnDestroy {
  urlInput = '';
  report: ScanReport | null = null;
  errorMessage = '';
  scanning = false;
  history: ScanReport[] = [];

  private scanner: Html5Qrcode | null = null;

  constructor(private checker: UrlCheckerService, private cdr: ChangeDetectorRef) {
    this.loadHistory();
  }

  // ---------- Typed link ----------
  checkUrl() {
    this.showResult(this.urlInput);
  }

  // ---------- Show result ----------
  private showResult(text: string) {
    this.errorMessage = '';
    this.report = this.checker.analyze(text);
    if (!this.report) {
      this.errorMessage = 'Please enter a link or scan a QR code.';
    } else {
      this.saveToHistory(this.report);
    }
    this.cdr.detectChanges();
  }

  // ---------- Camera ----------
  async startCamera() {
    this.errorMessage = '';
    this.report = null;
    this.scanning = true;
    try {
      this.scanner = new Html5Qrcode('reader');
      await this.scanner.start(
        { facingMode: 'environment' },          // back camera on phones
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          if (!this.scanning) return;           // ignore extra scans
          await this.stopCamera();
          this.showResult(decodedText);
        },
        () => {}                                // no QR in this frame: ignore
      );
    } catch {
      this.scanning = false;
      this.errorMessage = 'Could not start the camera. Allow camera access or use "Upload image".';
      this.cdr.detectChanges();
    }
  }

  async stopCamera() {
    this.scanning = false;
    if (this.scanner) {
      try {
        await this.scanner.stop();
        this.scanner.clear();
      } catch {}
      this.scanner = null;
    }
    this.cdr.detectChanges();
  }

  // ---------- Upload image ----------
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    await this.stopCamera();
    try {
      const reader = new Html5Qrcode('reader');
      const text = await reader.scanFile(file, false);
      reader.clear();
      this.showResult(text);
    } catch {
      this.report = null;
      this.errorMessage = 'No QR code found in this image.';
      this.cdr.detectChanges();
    }
    input.value = '';
  }

  // ---------- History ----------
  private saveToHistory(r: ScanReport) {
    this.history = [r, ...this.history.filter(h => h.originalText !== r.originalText)].slice(0, 10);
    try { localStorage.setItem('qr-history', JSON.stringify(this.history)); } catch {}
  }

  private loadHistory() {
    try {
      this.history = JSON.parse(localStorage.getItem('qr-history') || '[]');
    } catch {
      this.history = [];
    }
  }

  openFromHistory(r: ScanReport) {
    this.report = r;
    this.errorMessage = '';
  }

  clearHistory() {
    this.history = [];
    try { localStorage.removeItem('qr-history'); } catch {}
  }

  // ---------- Display helpers ----------
  icon(status: Status): string {
    if (status === 'safe') return '🟢';
    if (status === 'warning') return '🟡';
    return '🔴';
  }

  ratingText(status: Status): string {
    if (status === 'safe') return '🟢 Looks safe';
    if (status === 'warning') return '🟡 Be careful';
    return '🔴 Dangerous: do not open';
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}
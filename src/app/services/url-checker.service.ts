import { Injectable } from '@angular/core';

export type Status = 'safe' | 'warning' | 'danger';

export interface CheckResult {
  name: string;
  status: Status;
  message: string;
}

export interface ScanReport {
  originalText: string;
  type: string;     // Website, Wi-Fi, Phone call, SMS, Email, Text
  target: string;   // where it really goes
  checks: CheckResult[];
  rating: Status;
}

@Injectable({ providedIn: 'root' })
export class UrlCheckerService {

  private shorteners = [
    'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
    'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at'
  ];

  private brands = [
    'paypal', 'amazon', 'google', 'apple', 'microsoft', 'netflix',
    'facebook', 'instagram', 'whatsapp', 'dhl', 'sparkasse'
  ];

  private suspiciousWords = [
    'login', 'signin', 'verify', 'update', 'secure', 'account',
    'password', 'payment', 'confirm', 'banking'
  ];

  // ================= MAIN FUNCTION =================
  analyze(input: string): ScanReport | null {
    const text = input.trim();
    if (!text) return null;

    // 1. Wi-Fi, phone, SMS, email codes
    const special = this.analyzeSpecial(text);
    if (special) return special;

    // 2. "paypa1.com/login" without http:// → treat as a link
    let candidate = text;
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(candidate);
    const looksLikeDomain = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(candidate);
    if (!hasScheme && looksLikeDomain) {
      candidate = 'http://' + candidate;
    }

    // 3. Try to read it as a URL
    let url: URL | null = null;
    try {
      url = new URL(candidate);
    } catch {
      url = null;
    }

    // Not a link at all → plain text
    if (!url) {
      return this.report(text, 'Text', text, [{
        name: 'Plain text',
        status: 'safe',
        message: 'This code only contains text. No link and no action.'
      }]);
    }

    // A link, but not a normal website (e.g. javascript:, file:)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return this.report(text, 'Unknown link', url.protocol, [{
        name: 'Unusual link type',
        status: 'warning',
        message: `This code uses "${url.protocol}", which is not a normal website link. Do not open it unless you know what it is.`
      }]);
    }

    // 4. Normal website → run all checks
    const checks: CheckResult[] = [
      this.checkHttps(url),
      this.checkIpAddress(url),
      this.checkHiddenUser(url),
      this.checkPunycode(url),
      this.checkShortener(url),
      this.checkLookalike(url),
      this.checkSuspiciousWords(url),
    ];

    return this.report(text, 'Website', url.hostname, checks);
  }

  // ================= SPECIAL QR TYPES =================
  private analyzeSpecial(text: string): ScanReport | null {
    const lower = text.toLowerCase();

    if (lower.startsWith('wifi:')) {
      const ssid = this.wifiField(text, 'S') || 'unknown';
      const security = (this.wifiField(text, 'T') || 'nopass').toUpperCase();
      const isOpen = security === 'NOPASS';
      return this.report(text, 'Wi-Fi', ssid, [{
        name: 'Wi-Fi network',
        status: isOpen ? 'danger' : 'warning',
        message: isOpen
          ? `Connects you to "${ssid}", an OPEN network without a password. Others can see your traffic. Fake hotspots often look like this.`
          : `Connects you to "${ssid}" (${security}). Only join if you trust the place showing this code.`
      }]);
    }

    if (lower.startsWith('tel:')) {
      const number = text.slice(4);
      return this.report(text, 'Phone call', number, [{
        name: 'Phone call',
        status: 'warning',
        message: `This code will call ${number}. Scammers use expensive premium-rate numbers.`
      }]);
    }

    if (lower.startsWith('sms:') || lower.startsWith('smsto:')) {
      const number = text.replace(/^(smsto|sms):/i, '').split(/[:?]/)[0];
      return this.report(text, 'SMS', number, [{
        name: 'Text message',
        status: 'warning',
        message: `This code prepares an SMS to ${number}. Check the number before sending. Premium SMS can cost money.`
      }]);
    }

    if (lower.startsWith('mailto:')) {
      const email = text.slice(7).split('?')[0];
      return this.report(text, 'Email', email, [{
        name: 'Email',
        status: 'warning',
        message: `This code writes an email to ${email}. Never send passwords or personal data by email.`
      }]);
    }

    return null;
  }

  private wifiField(text: string, key: string): string {
    const match = text.match(new RegExp(`(?:^WIFI:|;)${key}:([^;]*)`, 'i'));
    return match ? match[1] : '';
  }

  // ================= WEBSITE CHECKS =================
  private checkHttps(url: URL): CheckResult {
    const name = 'Encrypted connection (HTTPS)';
    if (url.protocol === 'https:') {
      return { name, status: 'safe', message: 'The connection is encrypted. (Fake sites can use HTTPS too.)' };
    }
    return { name, status: 'warning', message: 'This link uses HTTP. Anything you type could be read by others.' };
  }

  private checkIpAddress(url: URL): CheckResult {
    const name = 'Real domain name';
    const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname);
    const isIPv6 = url.hostname.startsWith('[');
    if (isIPv4 || isIPv6) {
      return { name, status: 'danger', message: `Uses a raw IP address (${url.hostname}) instead of a website name. Real companies almost never do this.` };
    }
    return { name, status: 'safe', message: 'Uses a normal website name.' };
  }

  private checkHiddenUser(url: URL): CheckResult {
    const name = 'Hidden address trick (@)';
    if (url.username || url.password) {
      return { name, status: 'danger', message: `Everything before "@" is decoration. The link really goes to ${url.hostname}.` };
    }
    return { name, status: 'safe', message: 'No hidden "@" trick.' };
  }

  private checkPunycode(url: URL): CheckResult {
    const name = 'Lookalike letters';
    if (url.hostname.includes('xn--')) {
      return { name, status: 'danger', message: 'Uses special characters that can look identical to normal letters (e.g. Cyrillic "а").' };
    }
    return { name, status: 'safe', message: 'Only normal letters are used.' };
  }

  private checkShortener(url: URL): CheckResult {
    const name = 'Link shortener';
    const host = url.hostname.replace(/^www\./, '');
    if (this.shorteners.includes(host)) {
      return { name, status: 'warning', message: `${host} is a link shortener. The real destination is hidden.` };
    }
    return { name, status: 'safe', message: 'Not a shortened link.' };
  }

  private checkLookalike(url: URL): CheckResult {
    const name = 'Fake brand name';
    const labels = url.hostname.toLowerCase().split('.');
    const mainName = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
    const subdomains = labels.slice(0, -2);

    if (this.brands.includes(mainName)) {
      return { name, status: 'safe', message: `This is the official ${mainName} domain.` };
    }

    for (const brand of this.brands) {
      if (mainName.includes(brand)) {
        return { name, status: 'danger', message: `"${mainName}" contains "${brand}" but is NOT the official ${brand} website.` };
      }
      if (subdomains.some(s => s.includes(brand))) {
        return { name, status: 'danger', message: `"${brand}" only appears at the start. The real website is "${mainName}".` };
      }
      const maxDistance = brand.length < 6 ? 1 : 2;
      if (this.levenshtein(mainName, brand) <= maxDistance) {
        return { name, status: 'danger', message: `"${mainName}" looks almost exactly like "${brand}". Typical fake.` };
      }
    }
    return { name, status: 'safe', message: 'No imitation of known brands found.' };
  }

  private checkSuspiciousWords(url: URL): CheckResult {
    const name = 'Suspicious words';
    const text = (url.hostname + url.pathname).toLowerCase();
    const found = this.suspiciousWords.filter(w => text.includes(w));
    if (found.length > 0) {
      return { name, status: 'warning', message: `Contains words often used in phishing: ${found.join(', ')}.` };
    }
    return { name, status: 'safe', message: 'No typical phishing words.' };
  }

  // ================= HELPERS =================
  private report(originalText: string, type: string, target: string, checks: CheckResult[]): ScanReport {
    return { originalText, type, target, checks, rating: this.overallRating(checks) };
  }

  private overallRating(checks: CheckResult[]): Status {
    if (checks.some(c => c.status === 'danger')) return 'danger';
    if (checks.some(c => c.status === 'warning')) return 'warning';
    return 'safe';
  }

  // Counts how many letter changes turn word a into word b
  private levenshtein(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[a.length][b.length];
  }
}
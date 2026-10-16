# QR Shield: Anti-Quishing QR Scanner

A mobile app that checks QR codes for phishing **before** you open them.

"Quishing" (QR-code phishing) is a growing attack: fake QR codes are stuck on
parking meters, posters or restaurant tables and lead to fake login or payment
pages. Because humans can't read a QR code, victims never see the link before
it opens. QR Shield adds a safety check between scanning and opening.

## Features
- Scan QR codes with the camera or from an uploaded image
- 7 security checks for website links:
  - HTTPS vs. unencrypted HTTP
  - Raw IP address instead of a domain name
  - Hidden "@" trick (e.g. `google.com@evil.com`)
  - Punycode / homograph attack (lookalike letters such as Cyrillic "а")
  - Link shorteners that hide the real destination
  - Lookalike brand domains using Levenshtein distance (e.g. `paypa1.com`)
  - Typical phishing keywords (login, verify, payment ...)
- Detects Wi-Fi, phone, SMS and email QR codes and explains their risks
- Traffic-light rating (safe / be careful / dangerous) with plain-language reasons
- History of recent scans

## Screenshots
| Safe | Warning | Dangerous | Wi-Fi |
|---|---|---|---|
| ![Safe](screenshots/safe.png) | ![Warning](screenshots/warning.png) | ![Dangerous](screenshots/danger.png) | ![Wi-Fi](screenshots/wifi.png) |

## Tech stack
Ionic 9, Angular, TypeScript, Capacitor (Android), html5-qrcode

## How to run
```bash
npm install
ionic serve
```

For Android:
```bash
ionic build
npx cap sync android
npx cap open android
```

## Known limitations
- Domains with two-part endings (e.g. `.co.uk`) are not fully handled
- Shortened links are flagged, but not followed to their real destination
- Lookalike detection can give occasional false alarms

## Author
Aiwan Shibu

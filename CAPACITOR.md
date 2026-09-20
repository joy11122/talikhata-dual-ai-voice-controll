# TaliKhata Voice — Capacitor Mobile Setup

TaliKhata is a Next.js server application. Capacitor is used as a native Android/iOS shell around the deployed HTTPS Next.js app.

## Why remote loading?

MongoDB, Auth.js secrets, OpenAI keys, and server-side business logic must stay on the server. Do **not** bundle `.env.local`, MongoDB credentials, or OpenAI keys into a mobile build.

Recommended production flow:

```text
Android / iOS
      ↓
 Capacitor WebView
      ↓ HTTPS
Next.js deployment
      ↓
Auth.js / API / Server Actions
      ↓
MongoDB Atlas
```

## 1. Install

From the project root:

```powershell
npm install --legacy-peer-deps
```

If Capacitor packages were added to `package.json`, then:

```powershell
npm install
```

If npm reports the existing OpenAI/Zod peer conflict, use:

```powershell
npm install --legacy-peer-deps
```

## 2. Add native platforms

Android:

```powershell
npx cap add android
```

iOS (requires macOS + Xcode):

```bash
npx cap add ios
```

## 3. Point the shell to your deployed Next.js site

PowerShell:

```powershell
$env:CAP_SERVER_URL="https://YOUR-DOMAIN.com"
npx cap sync
```

Do not use a temporary localhost URL for a production APK.

For Android development on the same Wi-Fi network you can use your PC's LAN IP if your Next.js dev server is reachable from the phone, for example:

```powershell
$env:CAP_SERVER_URL="http://192.168.1.10:3000"
npx cap sync android
```

The Android emulator can normally use `http://10.0.2.2:3000` to reach the host machine, but configure this only for development.

## 4. Open Android Studio

```powershell
npx cap open android
```

Then select an emulator/phone and run the app.

## 5. Open Xcode

On macOS:

```bash
npx cap open ios
```

## 6. After every web deployment change

For the remote-server architecture, a new web deployment is immediately available to the shell after the server is updated. If native plugins/configuration changed, run:

```powershell
npx cap sync
```

## Native functionality planned for the app

- Native Android/iOS shell
- Android back-button handling
- Microphone permissions for voice
- Haptic feedback
- Keyboard behavior
- Status-bar integration
- Camera/product-image support can be added with Capacitor Camera
- Push notifications can be added with Capacitor Push Notifications
- Share/export can be added with Capacitor Share

## Authentication notes

Google OAuth and Credentials authentication remain server-side. Configure your production Auth.js callback URL for the deployed HTTPS domain. If a future release needs native deep-link OAuth callbacks, add a custom URL scheme/app link flow rather than putting OAuth secrets in the app.

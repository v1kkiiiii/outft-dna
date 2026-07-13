# OUTFT — test app

Outfit analysis & Style DNA test app. Expo + React Native + TypeScript.
Design matches the OUTFT website (Cormorant Garamond + Jost, ink on white).

## Run it on your iPhone

1. Install **Expo Go** from the App Store on your iPhone.
2. Make sure your iPhone and Mac are on the same Wi-Fi.
3. In Terminal:

   ```
   cd ~/Documents/docs/outft-test
   npm start
   ```

4. Scan the QR code with your iPhone Camera app. The app opens in Expo Go.

## Flow

Welcome → create username → Home → Upload outfit photo → Analyze → Style DNA result → saved to History.

## What's real vs mocked

- **Real:** all screens, photo picking, local storage (username + history persist across app restarts via AsyncStorage).
- **Mocked:** the analysis itself. `src/mockAnalysis.ts` returns one of four realistic Style DNA results (deterministic per photo). Replace `analyzeOutfit()` with the real algorithm later — nothing else needs to change.
- **Not included (on purpose):** Supabase, login, payments, friends, notifications, custom backend. The "OUTFT Plus" button is a coming-soon placeholder.

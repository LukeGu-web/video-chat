# EmoMate Dependency Upgrade — Expo SDK 55

**Date**: 2026-04-08  
**Branch**: `deps/upgrade-expo-55` (from `main`)  
**Scope**: EmoMate React Native app only

---

## Goal

Update EmoMate dependencies in two batches:

1. Upgrade Expo SDK 54 → 55 (all expo-* packages aligned via `expo install --fix`)
2. Update safe non-expo packages (minor/patch, no breaking changes)

Packages with major breaking changes are explicitly skipped and left for manual review.

---

## Batch 1 — Expo SDK 55 Upgrade

**Commands:**

```bash
cd EmoMate
npx expo install expo@^55
npx expo install --fix
```

`expo install --fix` automatically aligns all expo-* packages, babel-preset-expo, react, and react-native to the versions compatible with SDK 55.

**Packages affected:**

| Package | Current | Target |
|---------|---------|--------|
| expo | ~54.0.33 | ~55.x |
| expo-asset | ~12.0.12 | ~55.x |
| expo-audio | ~1.1.1 | ~55.x |
| expo-build-properties | ~1.0.10 | ~55.x |
| expo-constants | ~18.0.13 | ~55.x |
| expo-dev-client | ~6.0.20 | ~55.x |
| expo-file-system | ~19.0.21 | ~55.x |
| expo-image-manipulator | ~14.0.8 | ~55.x |
| expo-speech | ~14.0.8 | ~55.x |
| expo-speech-recognition | ^2.1.1 | ^3.x (major — check API) |
| expo-sqlite | ~16.0.10 | ~55.x |
| expo-status-bar | ~3.0.9 | ~55.x |
| babel-preset-expo | ~54.0.10 | ~55.x |
| react | 19.1.0 | SDK 55 target |
| react-native | 0.81.5 | SDK 55 target |

**Note on expo-speech-recognition**: jumps from 2.x to 3.x. After the upgrade, verify that `useSpeechRecognition` API in `src/capabilities/listen/` still works as expected.

**Commit after Batch 1.**

---

## Batch 2 — Safe Non-Expo Package Updates

**Command:**

```bash
npm install \
  @react-navigation/native@^7.2.2 \
  @react-navigation/native-stack@^7.14.10 \
  @types/react@^19.2.14 \
  dotenv@^17.4.1 \
  nativewind@^4.2.3 \
  react-native-gesture-handler@^2.31.0 \
  react-native-mmkv@^4.3.1 \
  react-native-nitro-modules@^0.31.10 \
  react-native-reanimated@^4.3.0 \
  react-native-safe-area-context@^5.7.0 \
  react-native-screens@^4.24.0 \
  react-native-svg@^15.15.4 \
  react-native-vision-camera@^4.7.3 \
  react-native-vision-camera-face-detector@^1.10.2 \
  react-native-webview@^13.16.1 \
  react-native-worklets-core@^1.6.3 \
  zustand@^5.0.12
```

All updates are within the same major version. No API changes expected.

**Commit after Batch 2.**

---

## Skipped — Manual Review Required

| Package | Current | Latest | Reason |
|---------|---------|--------|--------|
| tailwindcss | 3.4.17 | 4.2.2 | v4 is a complete rewrite; requires simultaneous upgrade to nativewind v5 |
| typescript | 5.9.3 | 6.0.2 | TypeScript 6 has breaking changes |
| immer | 10.1.1 | 11.1.4 | Major version bump |
| react-native-worklets | 0.5.1 | 0.8.1 | Large minor jump for a sensitive native module |

---

## Post-Upgrade Verification

After both batches:

1. Run `npx tsc --noEmit` — confirm no TypeScript errors
2. Run `npx expo start --clear` — confirm app starts without errors
3. Manually test: voice recognition, TTS, Live2D WebView, camera/face detection
4. Check `expo-speech-recognition` usage in `src/capabilities/listen/` for any API changes

---

## Out of Scope

- character (web app) — separate project, not touched here
- Any feature changes
- tailwindcss/nativewind v4→v5 migration (separate task)
- TypeScript 6 migration (separate task)

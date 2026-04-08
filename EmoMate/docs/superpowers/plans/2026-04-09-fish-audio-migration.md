# Fish Audio Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ElevenLabs TTS provider with Fish Audio (model s2-pro, reference_id `5ae25bb863d548879af70c0d0667f070`) across EmoMate, preserving the existing `TTSProvider` interface and `ExpoSpeechProvider` fallback.

**Architecture:** New `fishAudioAPI.ts` + `FishAudioProvider.ts` replace the ElevenLabs equivalents. All other layers (`TTSQueue`, `AudioCache`, `SmartSentenceBuffer`, `ExpoSpeechProvider`) remain untouched. Emotion is expressed via inline text tags + per-emotion temperature/speed tuning instead of ElevenLabs stability/similarity parameters.

**Tech Stack:** Fish Audio REST API (`https://api.fish.audio/v1/tts`), `expo-file-system` (File/Paths), `expo-audio` (createAudioPlayer), XMLHttpRequest (arraybuffer response).

---

## File Map

| Action | Path |
|---|---|
| Create | `src/capabilities/speak/fishAudioAPI.ts` |
| Create | `src/capabilities/speak/providers/FishAudioProvider.ts` |
| Modify | `src/constants/ai.ts` |
| Modify | `src/types/speak/common.ts` |
| Modify | `src/capabilities/speak/queue/TTSQueue.ts` |
| Modify | `src/capabilities/speak/index.ts` |
| Modify | `app.config.ts` |
| Delete | `src/capabilities/speak/elevenLabsAPI.ts` |
| Delete | `src/capabilities/speak/providers/ElevenLabsProvider.ts` |

---

## Task 1: Update environment config

**Files:**
- Modify: `app.config.ts:81`

- [ ] **Step 1: Replace ElevenLabs key with Fish Audio key in `app.config.ts`**

In `app.config.ts`, replace line 81:
```typescript
// Before
elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,

// After
fishAudioApiKey: process.env.FISH_AUDIO_API_KEY,
```

- [ ] **Step 2: Update `.env` file**

In your `.env` file (or equivalent), remove the old key and add the new one:
```
# Remove this line:
ELEVENLABS_API_KEY=...

# Add this line with your Fish Audio API key from https://fish.audio/settings/
FISH_AUDIO_API_KEY=<your_fish_audio_api_key>
```

- [ ] **Step 3: Commit**

```bash
git add app.config.ts
git commit -m "config: replace ElevenLabs API key with Fish Audio API key"
```

---

## Task 2: Update `constants/ai.ts`

**Files:**
- Modify: `src/constants/ai.ts`

This task has several sub-steps. Make all changes to `ai.ts` before committing.

- [ ] **Step 1: Add `getFishAudioApiKey()` after `getClaudeApiKey()` (line ~33)**

Replace the existing `getElevenLabsApiKey` function (lines 35-38):
```typescript
// Remove this:
// 获取 ElevenLabs API Key
export const getElevenLabsApiKey = (): string | undefined => {
  return Constants.expoConfig?.extra?.elevenLabsApiKey;
};

// Replace with:
// Get Fish Audio API Key
export const getFishAudioApiKey = (): string | undefined => {
  return Constants.expoConfig?.extra?.fishAudioApiKey;
};
```

- [ ] **Step 2: Replace `ELEVENLABS_CONFIG` with `FISH_AUDIO_CONFIG` (line ~381)**

Remove the entire `ELEVENLABS_CONFIG` block (lines 380–467) and replace with:
```typescript
// Fish Audio configuration - optimized for 兰兰 (gentle older sister)
export const FISH_AUDIO_CONFIG = {
  baseURL: 'https://api.fish.audio/v1',
  version: 's2-pro' as const,
  voices: {
    lanlan: '5ae25bb863d548879af70c0d0667f070',
    default: '5ae25bb863d548879af70c0d0667f070',
  },
  defaultVoice: 'lanlan' as const,
  settings: {
    format: 'mp3',
    latency: 'normal',
    temperature: 0.78,
    top_p: 0.75,
    normalize: true,
    repetition_penalty: 1.2,
    prosody: { speed: 0.93, volume: 0, normalize_loudness: true },
  },
  emotionalSettings: {
    gentle:   { temperature: 0.78, top_p: 0.75, textPrefix: '',          prosody: { speed: 0.93 } },
    happy:    { temperature: 0.85, top_p: 0.80, textPrefix: '(excited)', prosody: { speed: 1.00 } },
    caring:   { temperature: 0.70, top_p: 0.70, textPrefix: '(sad)',     prosody: { speed: 0.88 } },
    shy:      { temperature: 0.72, top_p: 0.72, textPrefix: '',          prosody: { speed: 0.90 } },
    thinking: { temperature: 0.68, top_p: 0.70, textPrefix: '',          prosody: { speed: 0.95 } },
  },
};
```

- [ ] **Step 3: Update `getAICapabilities()` (line ~486–504)**

Replace the two changed lines inside `getAICapabilities()`:
```typescript
// Before
const elevenLabsApiKey = getElevenLabsApiKey();
// ...
      isAvailable: !!elevenLabsApiKey,
      provider: 'ElevenLabs',

// After
const fishAudioApiKey = getFishAudioApiKey();
// ...
      isAvailable: !!fishAudioApiKey,
      provider: 'Fish Audio',
```

- [ ] **Step 4: Remove deleted helper functions**

Delete these three functions from `ai.ts` (they were only used by `elevenLabsAPI.ts`):
- `getLanLanVoiceId()` (line ~770)
- `getEmotionalVoiceSettings()` (line ~739)
- `preprocessTextForNaturalSpeech()` (line ~775)

- [ ] **Step 5: Update `VOICE_CONFIG` export (line ~1288)**

Replace the entire `VOICE_CONFIG` block with:
```typescript
// Export voice config for external access
export const VOICE_CONFIG = {
  lanlan: {
    referenceId: FISH_AUDIO_CONFIG.voices.lanlan,
    defaultSettings: FISH_AUDIO_CONFIG.settings,
    emotionalSettings: FISH_AUDIO_CONFIG.emotionalSettings,
  },
  getEmotionSettings: (emotion?: string) => {
    const key = emotion as keyof typeof FISH_AUDIO_CONFIG.emotionalSettings;
    return FISH_AUDIO_CONFIG.emotionalSettings[key] ?? FISH_AUDIO_CONFIG.emotionalSettings.gentle;
  },
};
```

- [ ] **Step 6: Commit**

```bash
git add src/constants/ai.ts
git commit -m "refactor(ai): replace ELEVENLABS_CONFIG with FISH_AUDIO_CONFIG"
```

---

## Task 3: Update TTS provider type

**Files:**
- Modify: `src/types/speak/common.ts:6`

- [ ] **Step 1: Change `TTSProviderType`**

In `src/types/speak/common.ts`, replace line 6:
```typescript
// Before
export type TTSProviderType = 'expo' | 'elevenlabs';

// After
export type TTSProviderType = 'expo' | 'fishaudio';
```

- [ ] **Step 2: Commit**

```bash
git add src/types/speak/common.ts
git commit -m "types: update TTSProviderType to fishaudio"
```

---

## Task 4: Create `fishAudioAPI.ts`

**Files:**
- Create: `src/capabilities/speak/fishAudioAPI.ts`

- [ ] **Step 1: Create the file**

Create `src/capabilities/speak/fishAudioAPI.ts` with this content:
```typescript
// src/capabilities/speak/fishAudioAPI.ts

import { File, Paths } from 'expo-file-system';
import { FISH_AUDIO_CONFIG, getFishAudioApiKey } from '../../constants/ai';
import { safeDeleteFile } from '../../utils/fileSystemHelpers';
import { TTSSynthesisOptions, TTSSynthesisResult } from '../../types/speak';

/**
 * Synthesize speech using Fish Audio API
 * Pure function with no side effects except network and file I/O
 */
export async function synthesizeWithFishAudio(
  text: string,
  options?: TTSSynthesisOptions
): Promise<TTSSynthesisResult> {
  const apiKey = getFishAudioApiKey()?.trim();
  if (!apiKey) {
    throw new Error('Fish Audio API key not configured');
  }

  // Resolve emotion settings (default to gentle if not specified)
  const emotionKey = (options?.emotion ?? 'gentle') as keyof typeof FISH_AUDIO_CONFIG.emotionalSettings;
  const emotionSettings =
    FISH_AUDIO_CONFIG.emotionalSettings[emotionKey] ??
    FISH_AUDIO_CONFIG.emotionalSettings.gentle;

  // Prepend emotion tag to text if required
  const processedText = emotionSettings.textPrefix
    ? `${emotionSettings.textPrefix} ${text}`
    : text;

  const referenceId = options?.voiceId ?? FISH_AUDIO_CONFIG.voices.lanlan;
  const url = `${FISH_AUDIO_CONFIG.baseURL}/tts`;

  // Create temp file
  const fileName = `fishaudio_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}.mp3`;
  const file = new File(Paths.document, fileName);
  file.create();

  const requestBody = {
    text: processedText,
    reference_id: referenceId,
    format: FISH_AUDIO_CONFIG.settings.format,
    latency: FISH_AUDIO_CONFIG.settings.latency,
    version: FISH_AUDIO_CONFIG.version,
    temperature: emotionSettings.temperature,
    top_p: emotionSettings.top_p,
    normalize: FISH_AUDIO_CONFIG.settings.normalize,
    repetition_penalty: FISH_AUDIO_CONFIG.settings.repetition_penalty,
    prosody: {
      speed: emotionSettings.prosody.speed,
      volume: FISH_AUDIO_CONFIG.settings.prosody.volume,
      normalize_loudness: FISH_AUDIO_CONFIG.settings.prosody.normalize_loudness,
    },
  };

  try {
    const audioUri = await makeFishAudioRequest(url, apiKey, requestBody, file);
    return { audioUri, duration: undefined };
  } catch (error) {
    await safeDeleteFile(file.uri);
    throw error;
  }
}

/**
 * Make Fish Audio REST request
 * Uses arraybuffer response type for direct binary write
 */
async function makeFishAudioRequest(
  url: string,
  apiKey: string,
  body: object,
  file: File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.responseType = 'arraybuffer';

    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = async () => {
      if (xhr.status === 200) {
        try {
          const audioBytes = new Uint8Array(xhr.response as ArrayBuffer);
          if (audioBytes.length === 0) {
            throw new Error('Received empty audio data from Fish Audio');
          }
          file.write(audioBytes);
          resolve(file.uri);
        } catch (error) {
          await safeDeleteFile(file.uri);
          reject(new Error(`Failed to save audio file: ${error}`));
        }
      } else {
        let errorMessage = `Fish Audio API error: ${xhr.status}`;
        try {
          const errorText = new TextDecoder().decode(
            new Uint8Array(xhr.response as ArrayBuffer)
          );
          console.error(`[FishAudioAPI] Error response (${xhr.status}):`, errorText);
          errorMessage = `${errorMessage} - ${errorText}`;
        } catch (_e) {
          console.error('[FishAudioAPI] Could not parse error response');
        }
        await safeDeleteFile(file.uri);
        reject(new Error(errorMessage));
      }
    };

    xhr.onerror = async () => {
      await safeDeleteFile(file.uri);
      reject(new Error('Network request failed'));
    };

    xhr.send(JSON.stringify(body));
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/capabilities/speak/fishAudioAPI.ts
git commit -m "feat(speak): add Fish Audio API synthesis function"
```

---

## Task 5: Create `FishAudioProvider.ts`

**Files:**
- Create: `src/capabilities/speak/providers/FishAudioProvider.ts`

- [ ] **Step 1: Create the file**

Create `src/capabilities/speak/providers/FishAudioProvider.ts` with this content:
```typescript
// src/capabilities/speak/providers/FishAudioProvider.ts

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import {
  TTSProvider,
  TTSSynthesisOptions,
  TTSSynthesisResult,
} from '../../../types/speak';
import { synthesizeWithFishAudio } from '../fishAudioAPI';
import { getFishAudioApiKey } from '../../../constants/ai';
import { audioModeManager } from '../../../utils/audioModeManager';

/**
 * Fish Audio TTS Provider
 * Implements TTSProvider interface using Fish Audio s2-pro model
 */
export class FishAudioProvider implements TTSProvider {
  readonly name = 'fishaudio';
  private currentPlayer: AudioPlayer | null = null;
  private currentSubscription: { remove: () => void } | null = null;
  private isCurrentlyPlaying = false;

  async isAvailable(): Promise<boolean> {
    const apiKey = getFishAudioApiKey();
    return !!apiKey;
  }

  async synthesize(
    text: string,
    options?: TTSSynthesisOptions
  ): Promise<TTSSynthesisResult> {
    return synthesizeWithFishAudio(text, options);
  }

  async play(
    audioUri: string,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    try {
      this.cleanupCurrentPlayer();

      // Set audio mode to playback for louder speaker output
      await audioModeManager.setPlaybackMode();

      this.currentPlayer = createAudioPlayer({ uri: audioUri });
      this.currentPlayer.volume = 1.0;

      console.log('[FishAudioProvider] 🔊 Created audio player for:', audioUri);

      this.currentSubscription = this.currentPlayer.addListener(
        'playbackStatusUpdate',
        (status) => {
          if (status.playing && !this.isCurrentlyPlaying) {
            this.isCurrentlyPlaying = true;
            console.log('[FishAudioProvider] ▶️ Playback started');
            callbacks?.onStart?.();
          }
          if (status.didJustFinish) {
            console.log('[FishAudioProvider] ✅ Playback finished');
            this.isCurrentlyPlaying = false;
            this.cleanupCurrentPlayer();
            callbacks?.onEnd?.();
          }
        }
      );

      this.currentPlayer.play();
      console.log('[FishAudioProvider] 🎵 Started playback');
    } catch (error) {
      this.isCurrentlyPlaying = false;
      console.error('[FishAudioProvider] ❌ Play error:', error);
      this.cleanupCurrentPlayer();
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    console.log('[FishAudioProvider] 🛑 Stopping playback');
    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
      } catch (e) {
        console.warn('[FishAudioProvider] ⚠️ Error pausing player:', e);
      }
    }
    this.isCurrentlyPlaying = false;
    this.cleanupCurrentPlayer();
  }

  async cleanup(): Promise<void> {
    console.log('[FishAudioProvider] 🧹 Cleanup');
    this.isCurrentlyPlaying = false;
    this.cleanupCurrentPlayer();
  }

  private cleanupCurrentPlayer(): void {
    if (this.currentSubscription) {
      try {
        this.currentSubscription.remove();
      } catch (e) {
        console.warn('[FishAudioProvider] ⚠️ Error removing subscription:', e);
      }
      this.currentSubscription = null;
    }
    if (this.currentPlayer) {
      try {
        this.currentPlayer.remove();
      } catch (e) {
        console.warn('[FishAudioProvider] ⚠️ Error removing player:', e);
      }
      this.currentPlayer = null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/capabilities/speak/providers/FishAudioProvider.ts
git commit -m "feat(speak): add FishAudioProvider implementing TTSProvider interface"
```

---

## Task 6: Update `TTSQueue.ts`

**Files:**
- Modify: `src/capabilities/speak/queue/TTSQueue.ts`

- [ ] **Step 1: Swap import and type**

In `src/capabilities/speak/queue/TTSQueue.ts`, make these three changes:

```typescript
// Line 10 — change import:
// Before:
import { ElevenLabsProvider } from '../providers/ElevenLabsProvider';
// After:
import { FishAudioProvider } from '../providers/FishAudioProvider';

// Line 26 — change field type:
// Before:
private provider: ElevenLabsProvider;
// After:
private provider: FishAudioProvider;

// Line 40 — change constructor default:
// Before:
this.provider = provider || new ElevenLabsProvider();
// After:
this.provider = provider || new FishAudioProvider();
```

Also update the constructor parameter type on line ~29:
```typescript
// Before:
constructor(
  config: TTSQueueConfig = {},
  provider?: ElevenLabsProvider,
  cache?: AudioCache
)
// After:
constructor(
  config: TTSQueueConfig = {},
  provider?: FishAudioProvider,
  cache?: AudioCache
)
```

- [ ] **Step 2: Commit**

```bash
git add src/capabilities/speak/queue/TTSQueue.ts
git commit -m "refactor(speak): swap ElevenLabsProvider for FishAudioProvider in TTSQueue"
```

---

## Task 7: Update barrel export and delete old files

**Files:**
- Modify: `src/capabilities/speak/index.ts`
- Delete: `src/capabilities/speak/elevenLabsAPI.ts`
- Delete: `src/capabilities/speak/providers/ElevenLabsProvider.ts`

- [ ] **Step 1: Update `index.ts`**

Replace the two ElevenLabs lines in `src/capabilities/speak/index.ts`:
```typescript
// Remove these two lines:
export { ElevenLabsProvider } from './providers/ElevenLabsProvider';
export { synthesizeWithElevenLabs } from './elevenLabsAPI';

// Add these two lines in their place:
export { FishAudioProvider } from './providers/FishAudioProvider';
export { synthesizeWithFishAudio } from './fishAudioAPI';
```

- [ ] **Step 2: Delete old files**

```bash
rm EmoMate/src/capabilities/speak/elevenLabsAPI.ts
rm EmoMate/src/capabilities/speak/providers/ElevenLabsProvider.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/capabilities/speak/index.ts
git add -u src/capabilities/speak/elevenLabsAPI.ts src/capabilities/speak/providers/ElevenLabsProvider.ts
git commit -m "refactor(speak): remove ElevenLabs files, export Fish Audio from barrel"
```

---

## Task 8: TypeScript check and smoke test

**Files:** No file changes — verification only.

- [ ] **Step 1: Run TypeScript check**

```bash
cd EmoMate && npx tsc --noEmit
```

Expected: zero errors. Common errors to fix:
- `Cannot find name 'getElevenLabsApiKey'` → you missed a reference in `ai.ts`, search and replace
- `Property 'voiceId' does not exist` → `VOICE_CONFIG.lanlan` now uses `referenceId`, update caller
- `Module not found: elevenLabsAPI` → an import wasn't updated; search for remaining `elevenLabsAPI` imports

- [ ] **Step 2: Fix any TypeScript errors, then re-run**

```bash
cd EmoMate && npx tsc --noEmit
```

Expected: `0 errors`

- [ ] **Step 3: Manual smoke test**

Start the app and send a text message to trigger TTS:
```bash
cd EmoMate && npx expo start
```

Verify in the Metro logs:
- `[FishAudioProvider] 🔊 Created audio player for: ...` appears
- `[FishAudioProvider] ▶️ Playback started` appears
- `[FishAudioProvider] ✅ Playback finished` appears
- No `402` or `401` errors in the log

If you see `Fish Audio API error: 401`, your `FISH_AUDIO_API_KEY` env var is not loaded — verify `.env` file and restart Metro with `npx expo start --clear`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: verify Fish Audio migration complete, TTS working"
```

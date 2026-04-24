# Fish Audio Migration Design

**Date**: 2026-04-09
**Status**: Approved
**Scope**: Replace ElevenLabs TTS provider with Fish Audio in EmoMate

## Background

ElevenLabs free tier no longer allows API access to library voices (HTTP 402 `paid_plan_required`). Fish Audio provides 4M characters/month free with API access, making it a direct replacement.

## Goal

Swap the ElevenLabs TTS provider for Fish Audio with minimal architectural change, preserving the existing `TTSProvider` interface and `ExpoSpeechProvider` fallback.

## Voice Configuration

- **Model**: Fish Audio s2-pro
- **Reference ID**: `5ae25bb863d548879af70c0d0667f070`
- **Character**: 兰兰（温柔姐姐型）

## File Changes

### New Files

- `src/capabilities/speak/fishAudioAPI.ts` — Fish Audio REST call (replaces `elevenLabsAPI.ts`)
- `src/capabilities/speak/providers/FishAudioProvider.ts` — implements `TTSProvider` interface (replaces `ElevenLabsProvider.ts`)

### Modified Files

- `src/capabilities/speak/queue/TTSQueue.ts` — replace `ElevenLabsProvider` import/usage with `FishAudioProvider`
- `src/constants/ai.ts`:
  - Replace `ELEVENLABS_CONFIG` with `FISH_AUDIO_CONFIG` (new shape defined below)
  - Replace `getElevenLabsApiKey()` with `getFishAudioApiKey()`
  - Remove `getLanLanVoiceId()`, `getEmotionalVoiceSettings()`, `preprocessTextForNaturalSpeech()` (all only used in `elevenLabsAPI.ts`)
  - Update `VOICE_CONFIG` export (line ~1288): replace `getLanLanVoiceId()`, `ELEVENLABS_CONFIG.settings/emotionalSettings`, `getEmotionalVoiceSettings` with Fish Audio equivalents
  - Update `getAICapabilities()` (line ~488): replace `getElevenLabsApiKey()` with `getFishAudioApiKey()`
- `src/types/speak/common.ts` — change `TTSProviderType` from `'expo' | 'elevenlabs'` to `'expo' | 'fishaudio'`
- `src/capabilities/speak/index.ts` — update barrel export
- `app.config.ts` — replace `elevenLabsApiKey` extra field with `fishAudioApiKey`

### Deleted Files

- `src/capabilities/speak/elevenLabsAPI.ts`
- `src/capabilities/speak/providers/ElevenLabsProvider.ts`

### Environment Variables

- Remove: `ELEVENLABS_API_KEY`
- Add: `FISH_AUDIO_API_KEY`

## API Design

### Request Format

```
POST https://api.fish.audio/v1/tts
Authorization: Bearer <api_key>
Content-Type: application/json
```

```json
{
  "text": "<processed text>",
  "reference_id": "5ae25bb863d548879af70c0d0667f070",
  "format": "mp3",
  "latency": "normal",
  "version": "s2-pro",
  "temperature": 0.78,
  "top_p": 0.75,
  "normalize": true,
  "repetition_penalty": 1.2,
  "prosody": {
    "speed": 0.93,
    "volume": 0,
    "normalize_loudness": true
  }
}
```

Response is raw binary MP3. Received via `XMLHttpRequest` with `responseType: 'arraybuffer'` (same pattern as existing `elevenLabsAPI.ts`), written to a temp file via `expo-file-system`.

### Emotion Parameter Mapping

Fish Audio s2-pro uses inline text tags + parameter tuning for emotion. The existing `TTSSynthesisOptions.emotion` field maps as follows:

| emotion value | Text prefix injected | temperature | top_p | prosody.speed |
|---|---|---|---|---|
| `gentle` / undefined (default) | _(none)_ | 0.78 | 0.75 | 0.93 |
| `happy` | `(excited)` | 0.85 | 0.80 | 1.00 |
| `caring` | `(sad)` | 0.70 | 0.70 | 0.88 |
| `shy` | _(none)_ | 0.72 | 0.72 | 0.90 |
| `thinking` | _(none)_ | 0.68 | 0.70 | 0.95 |

All emotions share: `normalize: true`, `repetition_penalty: 1.2`, `normalize_loudness: true`.

### FISH_AUDIO_CONFIG shape (constants/ai.ts)

```typescript
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
    gentle:   { temperature: 0.78, top_p: 0.75, textPrefix: '',           prosody: { speed: 0.93 } },
    happy:    { temperature: 0.85, top_p: 0.80, textPrefix: '(excited)',  prosody: { speed: 1.00 } },
    caring:   { temperature: 0.70, top_p: 0.70, textPrefix: '(sad)',      prosody: { speed: 0.88 } },
    shy:      { temperature: 0.72, top_p: 0.72, textPrefix: '',           prosody: { speed: 0.90 } },
    thinking: { temperature: 0.68, top_p: 0.70, textPrefix: '',           prosody: { speed: 0.95 } },
  },
};
```

## FishAudioProvider

Implements `TTSProvider` interface identically to `ElevenLabsProvider`:

- `name = 'fishaudio'`
- `isAvailable()` — checks `getFishAudioApiKey()`
- `synthesize()` — delegates to `fishAudioAPI.ts`
- `play()` / `stop()` / `cleanup()` — copied from `ElevenLabsProvider` (uses `expo-audio`, `audioModeManager`; no changes needed)

## TTSQueue Change

Single line change — replace import and constructor default:

```typescript
// Before
import { ElevenLabsProvider } from '../providers/ElevenLabsProvider';
private provider: ElevenLabsProvider;
constructor(...) { this.provider = provider || new ElevenLabsProvider(); }

// After
import { FishAudioProvider } from '../providers/FishAudioProvider';
private provider: FishAudioProvider;
constructor(...) { this.provider = provider || new FishAudioProvider(); }
```

## Error Handling

Fish Audio returns standard HTTP errors. The existing error handling pattern in `elevenLabsAPI.ts` (read response blob as text for error message) applies unchanged. Map HTTP status codes to meaningful errors:

- `401` — invalid API key
- `402` — quota exceeded
- `429` — rate limit

## Out of Scope

- ElevenLabs code is deleted entirely (no fallback to it)
- `preprocessTextForNaturalSpeech()` in `ai.ts` is kept only if referenced outside TTS
- No changes to `ExpoSpeechProvider` (remains as last-resort fallback)
- No changes to `AudioCache`, `TTSQueue` logic, `SmartSentenceBuffer`, or playback flow

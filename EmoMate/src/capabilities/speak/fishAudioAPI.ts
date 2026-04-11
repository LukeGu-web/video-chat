// src/capabilities/speak/fishAudioAPI.ts

import { File, Paths } from 'expo-file-system';
import { FISH_AUDIO_CONFIG, getFishAudioApiKey } from '../../constants/ai';
import { safeDeleteFile } from '../../utils/fileSystemHelpers';
import { TTSSynthesisOptions, TTSSynthesisResult } from '../../types/speak';

/**
 * Sanitize text before sending to TTS.
 *
 * Non-standard symbols (~ ... * #) are either read out literally by TTS or cause
 * unexpected behavior. We map them to standard Chinese punctuation that Fish Audio's
 * neural model already knows how to vocalize with the correct prosody:
 *
 *   ~  / ～  →  ——   (Chinese em-dash: produces a drawn-out, expressive sound)
 *   .../ …   →  ……   (Chinese ellipsis: produces natural hesitation / trailing pause)
 *   ** bold **        → keep inner text, drop asterisks
 *   # heading         → drop hash
 *
 * Leading punctuation is stripped so symbols can never appear at sentence start.
 */
export function sanitizeTextForTTS(text: string): string {
  return text
    // ~ / ～ → —— (drawn-out / cute trailing sound, e.g. "好的～" → "好的——")
    .replace(/[~～]+/g, '——')
    // ... (2+ dots) → …… (standard Chinese ellipsis for hesitation)
    .replace(/\.{2,}/g, '……')
    // Normalize multiple ellipsis chars to a single ……
    .replace(/…+/g, '……')
    // Remove markdown formatting — keep the text inside
    .replace(/\*{1,3}([^*]*)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_]*)_{1,2}/g, '$1')
    .replace(/#+\s*/g, '')
    // Markdown links — keep link text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Collapse repeated dashes or ellipses from multiple replacements
    .replace(/(——){2,}/g, '——')
    .replace(/(……){2,}/g, '……')
    .replace(/\s{2,}/g, ' ')
    // Strip punctuation from the start — symbols must follow text, not lead it
    .replace(/^[，。！？……——\s]+/, '')
    .trim();
}

/**
 * Returns true only if text contains at least one real character
 * (CJK, kana, letter, or digit) after sanitization.
 * Use this to skip punctuation-only TTS segments.
 */
export function hasMeaningfulContent(text: string): boolean {
  const sanitized = sanitizeTextForTTS(text);
  return /[\u4e00-\u9fff\u3040-\u30ff\w]/.test(sanitized);
}

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

  // Sanitize text to remove symbols TTS would read literally
  const sanitizedText = sanitizeTextForTTS(text);

  // Prepend emotion tag to text if required
  const processedText = emotionSettings.textPrefix
    ? `${emotionSettings.textPrefix} ${sanitizedText}`
    : sanitizedText;

  const referenceId = options?.voiceId ?? FISH_AUDIO_CONFIG.voices.lanlan;
  const url = `${FISH_AUDIO_CONFIG.baseURL}/tts`;

  // Create temp file
  const fileName = `fishaudio_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}.mp3`;
  const file = new File(Paths.document, fileName);

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
    file.create();
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

    xhr.onabort = async () => {
      await safeDeleteFile(file.uri);
      reject(new Error('Request was aborted'));
    };

    xhr.send(JSON.stringify(body));
  });
}

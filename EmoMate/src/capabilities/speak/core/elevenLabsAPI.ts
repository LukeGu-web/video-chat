// src/capabilities/speak/core/elevenLabsAPI.ts

import { File, Paths } from 'expo-file-system';
import {
  ELEVENLABS_CONFIG,
  getElevenLabsApiKey,
  getEmotionalVoiceSettings,
  getLanLanVoiceId,
  preprocessTextForNaturalSpeech,
} from '../../../constants/ai';
import {
  base64ToUint8Array,
  safeDeleteFile,
} from '../../../utils/fileSystemHelpers';
import { TTSSynthesisOptions, TTSSynthesisResult } from '../../../types/speak';

/**
 * Synthesize speech using ElevenLabs API
 * Pure function with no side effects except network and file I/O
 *
 * @param text Text to synthesize
 * @param options Synthesis options
 * @returns Audio file URI and duration
 */
export async function synthesizeWithElevenLabs(
  text: string,
  options?: TTSSynthesisOptions
): Promise<TTSSynthesisResult> {
  // Validate API key
  const apiKey = getElevenLabsApiKey()?.trim();
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  // Prepare request
  const voiceId = options?.voiceId || getLanLanVoiceId();
  const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voiceId}`;
  const voiceSettings = getEmotionalVoiceSettings(options?.emotion);
  const processedText = preprocessTextForNaturalSpeech(text);

  // Create temporary file
  const fileName = `elevenlabs_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}.mp3`;
  const file = new File(Paths.document, fileName);
  file.create();

  try {
    // Make API request using XMLHttpRequest
    const audioUri = await makeElevenLabsRequest(
      url,
      apiKey,
      {
        text: processedText,
        model_id: ELEVENLABS_CONFIG.defaultModel,
        voice_settings: voiceSettings,
      },
      file
    );

    return {
      audioUri,
      duration: undefined, // Duration will be determined during playback
    };
  } catch (error) {
    // Cleanup on error
    await safeDeleteFile(file.uri);
    throw error;
  }
}

/**
 * Make ElevenLabs API request
 * Internal helper function
 */
async function makeElevenLabsRequest(
  url: string,
  apiKey: string,
  body: any,
  file: File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.responseType = 'blob';

    xhr.setRequestHeader('Accept', 'audio/mpeg');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('xi-api-key', apiKey);

    xhr.onload = async () => {
      if (xhr.status === 200) {
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64data = reader.result as string;
              const base64Audio = base64data.split(',')[1];

              if (!base64Audio || base64Audio.trim().length === 0) {
                throw new Error('Received empty audio data from ElevenLabs');
              }

              const audioBytes = base64ToUint8Array(base64Audio);
              file.write(audioBytes);

              resolve(file.uri);
            } catch (error) {
              await safeDeleteFile(file.uri);
              reject(new Error(`Failed to save audio file: ${error}`));
            }
          };
          reader.readAsDataURL(xhr.response);
        } catch (error) {
          await safeDeleteFile(file.uri);
          reject(new Error(`Failed to process audio data: ${error}`));
        }
      } else {
        let errorMessage = `ElevenLabs API error: ${xhr.status}`;

        if (xhr.response instanceof Blob) {
          try {
            const errorReader = new FileReader();
            errorReader.onloadend = async () => {
              try {
                const errorText = errorReader.result as string;
                console.error(
                  `[ElevenLabsAPI] Error response (${xhr.status}):`,
                  errorText
                );
                await safeDeleteFile(file.uri);
                reject(new Error(`${errorMessage} - ${errorText}`));
              } catch (e) {
                console.error(`[ElevenLabsAPI] Could not parse error response`);
                await safeDeleteFile(file.uri);
                reject(new Error(errorMessage));
              }
            };
            errorReader.readAsText(xhr.response);
            return; // Wait for errorReader.onloadend
          } catch (e) {
            console.error(`[ElevenLabsAPI] Could not read error blob:`, e);
          }
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

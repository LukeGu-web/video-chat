/**
 * Speak capability module
 * Exports all speech synthesis utilities
 */

// TTS Hooks
export * from './useTTS';
export * from './useElevenLabsTTS';
export * from './useHybridTTS';

// TTS Infrastructure
export * from './soundPlayer';
export * from './sentenceDetector';
export * from './smartSentenceBuffer';
export * from './ttsQueue';

/**
 * Speak capability module
 * Exports all speech synthesis utilities
 */

// ==================== NEW ARCHITECTURE (Refactored) ====================

// Types - Re-export all types from project-level types folder
export * from '../../types/speak';

// Hooks
export { useTTS } from './hooks/useTTS';
export type { UseTTSReturn } from './hooks/useTTS';
export { useTTSQueue } from './hooks/useTTSQueue';
export type { UseTTSQueueReturn } from './hooks/useTTSQueue';

// Providers
export { ElevenLabsProvider } from './providers/ElevenLabsProvider';
export { ExpoSpeechProvider } from './providers/ExpoSpeechProvider';

// Cache
export { AudioCache, globalAudioCache, initializeTTSCache, preCacheCommonPhrases } from './cache/AudioCache';

// Queue
export { TTSQueue } from './queue/TTSQueue';

// Core
export { CACHE_PHRASES } from './core/constants';
export { synthesizeWithElevenLabs } from './core/elevenLabsAPI';

// ==================== OLD ARCHITECTURE (To be deprecated) ====================

// Legacy TTS Hooks - Will be replaced by new hooks/useTTS.ts
// export * from './useTTS';
// export * from './useElevenLabsTTS';
// export * from './useHybridTTS';

// Legacy TTS Infrastructure - Will be replaced by new modular architecture
export * from './soundPlayer';
export * from './sentenceDetector';
export * from './smartSentenceBuffer';
// export * from './ttsQueue';  // Replaced by queue/TTSQueue.ts

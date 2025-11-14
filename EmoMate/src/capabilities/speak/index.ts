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

// ==================== LEGACY INFRASTRUCTURE (Still in use) ====================

// These modules are still used and will be refactored in future phases
export * from './soundPlayer';
export * from './sentenceDetector';
export * from './smartSentenceBuffer';

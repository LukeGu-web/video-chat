# CLAUDE.md - Video Chat Project

This file provides guidance to Claude Code (claude.ai/code) when working with the multi-project video-chat repository.

## Repository Overview

The **Video Chat** repository contains a multi-project ecosystem for VRM character interaction and video chat functionality. It demonstrates the integration between React Native mobile applications and web-based VRM character display.

### Current Development Status: 🚀 **Production-Ready Multi-Modal AI Companion**

- **Multi-Project Architecture**: ✅ Complete with EmoMate + Character integration
- **Voice Conversation System**: ✅ Claude AI + ElevenLabs TTS + Speech Recognition
- **Emotion Detection System**: ✅ MLKit face detection + text analysis (5 emotions)
- **VRM Character System**: ✅ VRM avatar (兰兰) with motion + lip sync support
- **React Native WebView Bridge**: ✅ Bi-directional communication
- **Four-Layer Memory System**: ✅ MMKV + SQLite persistent memory across sessions
- **Vision & Environment Awareness**: ✅ Scene understanding + Object recognition (Claude Vision)
- **RAG System**: ✅ Retrieval-Augmented Generation for context-aware responses
- **Capabilities-Based Architecture**: ✅ Modular capability modules (speak/listen/vision/motion/emotion/retrieval)
- **Cross-Platform Compatibility**: ✅ Mobile and web integration
- **Overall Completion**: ✅ 92% - Production-ready

## Project Structure

```
video-chat/
├── EmoMate/                    # React Native mobile application
│   ├── src/
│   │   ├── capabilities/       # Core capability modules (NEW architecture)
│   │   │   ├── emotion/        # Emotion state management
│   │   │   ├── listen/         # Speech recognition
│   │   │   ├── motion/         # Avatar motion mapper
│   │   │   ├── retrieval/      # RAG pipeline (query → retrieve → generate)
│   │   │   ├── speak/          # TTS system (TTSQueue, providers, cache)
│   │   │   └── vision/         # Camera, face detection, scene understanding, object recognition
│   │   ├── components/
│   │   │   ├── vision/         # Camera and emotion detector UI
│   │   │   ├── scene-history/  # Scene history cards and tags
│   │   │   ├── CharacterWebView.tsx # WebView wrapper for character
│   │   │   └── FunctionMonitor.tsx # Debug function monitor
│   │   ├── hooks/
│   │   │   ├── ai/             # AI-specific hooks
│   │   │   │   ├── buildAIContext.ts       # Unified API config with prompt caching
│   │   │   │   ├── buildMemoryContext.ts   # Memory block builder
│   │   │   │   ├── useProactiveConversation.ts
│   │   │   │   └── useTopicSeeds.ts        # Memory-based topic seeds
│   │   │   ├── useChatAI.ts         # Main AI conversation hook
│   │   │   ├── useMemoryExtraction.ts
│   │   │   ├── useMemoryTriggers.ts
│   │   │   └── useAIConversationFlow.ts
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx       # Main screen
│   │   │   ├── ChatHistoryScreen.tsx
│   │   │   ├── SceneHistoryScreen.tsx  # NEW: scene history
│   │   │   └── WelcomeScreen.tsx
│   │   ├── store/
│   │   │   ├── chatStore.ts              # Chat history persistence
│   │   │   ├── memoryDatabase.ts         # SQLite (episodes + facts)
│   │   │   ├── memoryStore.ts            # MMKV (profile + preferences)
│   │   │   ├── sceneStore.ts             # Scene understanding state
│   │   │   ├── objectRecognitionStore.ts # Object recognition results
│   │   │   ├── backgroundStore.ts        # Background scene state
│   │   │   ├── emotionStore.ts           # Emotion state
│   │   │   ├── monitorStore.ts           # Function monitor state
│   │   │   └── userStore.ts              # User preferences
│   │   ├── types/
│   │   │   ├── memory.ts           # Memory system types
│   │   │   ├── scene.ts            # Scene/environment types
│   │   │   ├── speak/              # TTS type family
│   │   │   └── emotion.ts
│   │   └── constants/
│   │       ├── ai.ts               # Claude API config + conversation system (1298 lines)
│   │       ├── personality.ts      # 兰兰 character definition
│   │       ├── backgroundScenes.ts # Background scene library
│   │       └── speak.ts / vision.ts
│   ├── App.tsx                 # Root: audio config + TTS warmup + memory hydration
│   └── package.json
├── character/                  # Web application for VRM display
│   ├── app/
│   │   ├── components/
│   │   │   └── VRMAvatar.tsx
│   │   └── routes/
│   │       └── _index.tsx
│   ├── public/assets/vrm/
│   ├── vite.config.ts
│   └── package.json
└── CLAUDE.md                   # This file
```

## Multi-Project Architecture

### EmoMate (React Native Mobile App)

**Purpose**: Mobile application providing user interface for VRM character interaction

**Technology Stack**:
- React Native 0.81.5 with Expo SDK 54
- React 19.1.0 / TypeScript 5.9.2
- Zustand + Immer (state management)
- react-native-mmkv (MMKV key-value storage)
- expo-sqlite (SQLite database for memory)
- React Navigation v7

### Character (Web Application)

**Technology Stack**:
- Remix 2.16.8 with React 18
- PIXI.js 7.4.3 for WebGL rendering
- @pixiv/three-vrm for VRM rendering
- Vite 6.0.0

## Feature Overview

### Completed Features (92%)

#### Voice Conversation System
- **File**: `src/hooks/useChatAI.ts` (658 lines)
- Claude Haiku/Sonnet with streaming SSE
- Prompt caching (`cache_control`) for cost optimization
- Dynamic token config (simple: 80 / normal: 150 / detailed: 300 / storytelling: 500)
- Context: last 10 messages

#### TTS System (capabilities/speak/)
- **Architecture**: `TTSQueue` class — parallel synthesis + sequential playback
- **Providers**: ElevenLabsProvider + ExpoSpeechProvider (fallback)
- **Cache**: `AudioCache` — local file caching to avoid re-synthesis
- **Voice**: ElevenLabs voice ID `hkfHEbBvdQFNX4uWHqRF`
- App startup: TTS warmup in `App.tsx`

#### Four-Layer Memory System (NEW)
- **Layer 1 (MMKV)**: `UserProfile` + `UserPreferences` — always in RAM
- **Layer 2 (MMKV)**: Extraction trigger state + unprocessed messages
- **Layer 3 (SQLite)**: `episodes` table — conversation summaries (max 100 chars each)
- **Layer 4 (SQLite)**: `facts` table — knowledge facts with importance + expiry
- **Extraction**: Claude Haiku triggered on: message count (every 20), silence (5 min), background, startup
- **Injection**: `buildMemoryContext()` builds memory block injected into system prompt
- **Topic Seeds**: `useTopicSeeds()` generates conversation openers from memory
- **Key files**: `memoryDatabase.ts`, `memoryStore.ts`, `useMemoryExtraction.ts`, `useMemoryTriggers.ts`, `buildMemoryContext.ts`, `useTopicSeeds.ts`

#### Vision & Environment Awareness (capabilities/vision/)
- **Scene Understanding**: `useSceneUnderstanding.ts` (816 lines) — Claude Vision analyzes camera frames
- **Object Recognition**: `useObjectRecognition.ts` — identifies objects and injects context into AI
- **Face Detection**: `useFaceDetection.ts` — MLKit 1.9.0 at 60fps, 5 emotions
- **Scene Cache**: persistent scene data across sessions
- **Background Scenes**: 721-line library of dynamic conversation backgrounds

#### RAG System (capabilities/retrieval/)
- **Pipeline**: query analysis → multi-source retrieval → context building → generation
- **Modules**: `queryAnalyzer`, `multiSourceRetriever`, `contextBuilder`, `relevanceScoring`
- **Phase 3**: Conversation summarization + user feedback + performance monitoring
- **Key file**: `ragPipeline.ts`

#### Proactive Conversation System
- 3-stage silence detection: 1min / 2min / 3min
- Memory-based topic seeds as fallback (via `useTopicSeeds`)
- Context-aware topic selection from conversation history

#### VRM / Motion System
- **Motion Mapper** (`capabilities/motion/motionMapper.ts`, 398 lines): context-aware motion selection
- Plutchik 8-emotion model → VRM avatar motion mapping
- Motions: Idle, Happy, Surprised, Shy, Wave, Dance, Laugh, Thinking, Speaking, Excited, Sleepy
- WebView bridge for EmoMate ↔ Character communication

#### Emotion Detection
- **Facial**: MLKit via `useFaceDetection` — smilingProbability + eyeOpenProbability
- **Text**: keyword matching + Claude semantic analysis
- **Fusion**: text emotion takes priority over facial
- **Types** (Plutchik 8): joy, sadness, anger, fear, surprise, disgust, trust, anticipation

#### Bilingual Support
- Language detection: `src/utils/languageDetection.ts`
- Dynamic conversation system adapts to Chinese/English

### In Development / Planned
- ⏳ Testing framework (Jest + React Native Testing Library)
- ⏳ Lip sync improvements
- ⏳ Expand emotions (5 → 10+ types)
- ⏳ Cloud sync for memory

## Key Files Quick Reference

| System | File | Lines |
|--------|------|-------|
| AI config + conversation system | `src/constants/ai.ts` | 1298 |
| Scene understanding | `src/capabilities/vision/environment/useSceneUnderstanding.ts` | 816 |
| Background scene library | `src/constants/backgroundScenes.ts` | 721 |
| Claude Vision API | `src/capabilities/vision/claudeVision.ts` | 713 |
| Main AI chat hook | `src/hooks/useChatAI.ts` | 658 |
| Unified API context builder | `src/hooks/ai/buildAIContext.ts` | 595 |
| TTS Queue | `src/capabilities/speak/queue/TTSQueue.ts` | 413 |
| Main screen | `src/screens/HomeScreen.tsx` | 410 |
| Motion mapper | `src/capabilities/motion/motionMapper.ts` | 398 |
| Conversation summarizer | `src/capabilities/retrieval/conversationSummarizer.ts` | 341 |
| Background story util | `src/utils/backgroundStory.ts` | 357 |
| Personality (兰兰) | `src/constants/personality.ts` | 271 |

## Development Workflow

### Starting Development Environment

1. **Character Web App**:
   ```bash
   cd character
   npm install
   npm run dev  # Starts on http://192.168.31.28:5174/
   ```

2. **EmoMate Mobile App**:
   ```bash
   cd EmoMate
   npm install
   npx expo start
   ```

### TypeScript Check
```bash
cd EmoMate
npx tsc --noEmit
```

### Debug Mode
```bash
# EmoMate - shows debug overlays
SHOW_TEST_COMPONENTS=true npm start
```

## Network Configuration

- Character server: `0.0.0.0:5174` (accessible from mobile)
- WebView connection: `http://192.168.31.28:5174/`
- Same local network required for EmoMate ↔ Character integration

## Architecture Notes

### Capabilities Module Pattern
`src/capabilities/` groups functionality by capability domain. Each capability has its own `index.ts` barrel export. This replaces the old flat `utils/` structure for domain-specific logic.

### Store Architecture
Zustand stores are organized by domain:
- `chatStore` — persisted conversation history
- `memoryStore` — MMKV-backed user profile/preferences
- `memoryDatabase` — SQLite operations (episodes + facts)
- `sceneStore` — current scene data
- `emotionStore` — current emotion state
- `objectRecognitionStore` — recognition results
- `backgroundStore` — dynamic background state
- `monitorStore` — debug function monitor

### Prompt Caching Strategy
`buildAIContext.ts` uses `cache_control: { type: 'ephemeral' }` on stable system prompt blocks (personality, emotional context) to reduce Claude API costs.

### Memory Injection
`buildMemoryContext()` assembles a memory block from MMKV (profile + preferences) and SQLite (recent episodes + high-importance facts). This block is injected as a non-cached system prompt block, so it reflects the latest state on each conversation.

## Project Documentation

### Core Docs
- **CLAUDE.md** (this file): Multi-project overview
- **EmoMate/CLAUDE.md**: Detailed EmoMate guide
- **EmoMate/docs/MEMORY_SYSTEM_DESIGN.md**: Memory system design
- **EmoMate/docs/RAG_SYSTEM_DESIGN.md**: RAG system design
- **EmoMate/docs/VISUAL_CAPABILITY.md**: Vision system docs
- **EmoMate/docs/plans/**: Implementation plan history

## Summary

The video-chat repository is a **multi-modal AI companion** with:
- **Voice conversation** (Claude AI + ElevenLabs TTS)
- **Four-layer persistent memory** (MMKV + SQLite, extraction via Claude Haiku)
- **Visual intelligence** (Claude Vision scene analysis + MLKit face detection)
- **RAG system** (context-aware retrieval for richer responses)
- **VRM character animation** (emotion-responsive)
- **~24,000 lines** of TypeScript, capabilities-based architecture

**Current Status**: Production-ready core, 92% complete.

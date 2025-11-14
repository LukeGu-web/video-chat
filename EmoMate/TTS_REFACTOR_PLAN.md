# TTS 模块重构计划

**版本**: v1.0.0
**创建日期**: 2025-01-14
**状态**: 📝 待审核

---

## 📋 目录

- [1. 执行摘要](#1-执行摘要)
- [2. 当前问题分析](#2-当前问题分析)
- [3. 重构目标](#3-重构目标)
- [4. 新架构设计](#4-新架构设计)
- [5. 详细接口定义](#5-详细接口定义)
- [6. 代码示例](#6-代码示例)
- [7. 迁移步骤](#7-迁移步骤)
- [8. 风险评估](#8-风险评估)
- [9. 测试策略](#9-测试策略)
- [10. 时间估算](#10-时间估算)

---

## 1. 执行摘要

### 🎯 重构目标

**将 1,431 行分散在 4 个文件中的 TTS 代码重构为 13 个职责清晰的模块**

### 📊 预期收益

| 指标 | 当前 | 目标 | 改进 |
|------|------|------|------|
| 代码行数 | 1,431 行 | ~1,100 行 | ✅ -23% |
| 重复代码 | ~200 行 | 0 行 | ✅ -100% |
| 最大文件 | 806 行 | ~300 行 | ✅ -63% |
| 文件数 | 4 个 | 13 个 | ✅ 模块化 |
| API 风格 | 混乱 | 统一 | ✅ 一致性 |
| 类型管理 | 分散 | 项目级集中 | ✅ 易共享 |

### ⏱️ 预计时间

- **Phase 1-3**: 核心重构 5-8 小时
- **Phase 4-5**: 迁移测试 3-5 小时
- **总计**: 8-13 小时

---

## 2. 当前问题分析

### 📁 现有文件结构

```
capabilities/speak/
├── ttsQueue.ts              (806 行) - TTS队列 + 缓存 + API
├── useElevenLabsTTS.ts      (397 行) - ElevenLabs Hook
├── useHybridTTS.ts          (111 行) - Provider切换
└── useTTS.ts                (117 行) - Expo Speech Hook
```

### 🔴 核心问题

#### 问题 1: 严重的代码重复

**ElevenLabs API 调用被实现了两次**:

- `ttsQueue.ts:411-489` (79 行)
- `useElevenLabsTTS.ts:63-139` (77 行)

**重复内容**:
```typescript
// 两个文件都包含相同的逻辑:
✗ XMLHttpRequest 配置和错误处理
✗ base64 音频数据转换
✗ 文件系统写入操作
✗ preprocessTextForNaturalSpeech 调用
✗ getEmotionalVoiceSettings 调用
```

**影响**:
- 维护成本翻倍
- Bug 修复需要两处同步
- 代码库膨胀

#### 问题 2: 职责混乱

```
useChatAI.ts 同时使用:
├── useHybridTTS()           ← Hook API 风格
│   ├── useElevenLabsTTS()  ← ElevenLabs 实现 #1
│   └── useTTS()            ← Expo Speech
└── new TTSQueue()           ← Class API 风格
    └── callElevenLabsTTS() ← ElevenLabs 实现 #2 (重复!)

结果: 架构混乱，使用场景不清晰
```

#### 问题 3: 废弃代码

| 功能 | 位置 | 行数 | 状态 |
|------|------|------|------|
| `generateSpeechWithTimestamps` | useElevenLabsTTS.ts:141-266 | 125 行 | ❌ 从未使用 |
| `createMockSegments` | useElevenLabsTTS.ts:43-61 | 20 行 | ⚠️ 临时方案 |
| `currentSegment` | 多处 | ~30 行 | ⚠️ 可疑 |

**影响**: 约 175 行死代码占用空间

#### 问题 4: API 不一致

```typescript
// 风格 1: Hook API
const tts = useHybridTTS();
await tts.speak("你好");

// 风格 2: Class API
const queue = new TTSQueue();
queue.enqueue("你好");

// 问题: 两种风格混用，开发者困惑
```

#### 问题 5: 缺乏分层

当前代码缺乏清晰的分层架构:

```
❌ API 调用逻辑 ← 散落在多个文件
❌ 状态管理    ← 分散在 Hook 和 Class 中
❌ 音频缓存    ← 耦合在 ttsQueue.ts
❌ 队列管理    ← 和 API 调用混在一起
```

### 📊 代码重复详细分析

#### ElevenLabs API 调用重复代码对比

**ttsQueue.ts:411-489**:
```typescript
private async callElevenLabsTTS(text: string): Promise<string> {
  const apiKey = getElevenLabsApiKey();
  const voiceId = this.config.voiceId || getLanLanVoiceId();
  const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voiceId}`;
  const voiceSettings = getEmotionalVoiceSettings(this.config.userEmotion);

  // 创建临时文件
  const fileName = `tts_queue_${Date.now()}_${Math.random()...}.mp3`;
  const file = new File(Paths.document, fileName);

  // XMLHttpRequest 处理... (60+ 行)
  // base64 转换... (20+ 行)
  // 文件写入... (10+ 行)
}
```

**useElevenLabsTTS.ts:63-139**:
```typescript
const generateSpeechFile = async (text: string, voiceId?: string, userEmotion?: string): Promise<string> => {
  const apiKey = getElevenLabsApiKey();
  const voice = voiceId || getLanLanVoiceId();
  const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voice}`;
  const voiceSettings = getEmotionalVoiceSettings(userEmotion);

  // 创建临时文件
  const fileName = `elevenlabs_${Date.now()}.mp3`;
  const file = new File(Paths.document, fileName);

  // XMLHttpRequest 处理... (60+ 行) ← 完全相同!
  // base64 转换... (20+ 行) ← 完全相同!
  // 文件写入... (10+ 行) ← 完全相同!
}
```

**相似度**: 95%
**重复行数**: ~150 行

---

## 3. 重构目标

### 🎯 核心目标

#### 目标 1: 消除代码重复
- ✅ ElevenLabs API 调用只实现一次
- ✅ 音频文件管理逻辑统一
- ✅ 配置和常量集中管理

#### 目标 2: 统一 API 设计
- ✅ 所有 TTS 功能使用统一的 Hook API
- ✅ 简单播放和流式播放共享接口
- ✅ Provider 切换透明化

#### 目标 3: 清晰的分层架构
- ✅ Core 层: 纯函数，无副作用
- ✅ Provider 层: TTS 实现逻辑
- ✅ Cache 层: 音频缓存
- ✅ Queue 层: 队列管理
- ✅ Hook 层: React 集成

#### 目标 4: 删除废弃代码
- ✅ 移除 `generateSpeechWithTimestamps` (125 行)
- ✅ 移除 `createMockSegments` (20 行)
- ✅ 评估并优化 `currentSegment` 功能

#### 目标 5: 提高可测试性
- ✅ 纯函数易于单元测试
- ✅ Provider 接口支持 Mock
- ✅ 依赖注入支持

### 📐 设计原则

1. **单一职责原则** - 每个模块只做一件事
2. **开闭原则** - 易于扩展新 Provider，无需修改现有代码
3. **依赖倒置** - 高层模块不依赖低层实现
4. **接口隔离** - 小而专注的接口
5. **DRY 原则** - 不重复自己

---

## 4. 新架构设计

### 🏗️ 目录结构

```
src/
├── types/                          # 项目级类型定义
│   └── speak/                     # TTS 类型定义层 - 所有 TTS TypeScript 类型集中管理
│       ├── index.ts               # 统一类型导出 (~20 行)
│       ├── common.ts              # 通用类型定义 (~100 行)
│       ├── provider.ts            # Provider 接口定义 (~50 行)
│       ├── cache.ts               # 缓存接口定义 (~40 行)
│       └── queue.ts               # 队列接口定义 (~50 行)
│
└── capabilities/
    └── speak/
        ├── core/                   # 核心层 - 纯函数，无副作用
        │   ├── constants.ts       # 常量和配置 (~30 行)
        │   └── elevenLabsAPI.ts   # ElevenLabs API 封装 (~150 行)
        │
        ├── providers/              # Provider 层 - TTS 实现
        │   ├── ExpoSpeechProvider.ts      # Expo Speech 实现 (~120 行)
        │   └── ElevenLabsProvider.ts      # ElevenLabs 实现 (~180 行)
        │
        ├── cache/                  # 缓存层
        │   └── AudioCache.ts      # 音频缓存实现 (~180 行)
        │
        ├── queue/                  # 队列层
        │   └── TTSQueue.ts        # 队列管理实现 (~300 行)
        │
        ├── hooks/                  # Hook 层 - React 集成
        │   ├── useTTS.ts          # 统一 TTS Hook (~150 行)
        │   └── useTTSQueue.ts     # 队列 Hook (~100 行)
        │
        └── index.ts                # 公共 API 导出 (~30 行)
```

### 🔄 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                         应用层                                │
│                    (useChatAI.ts, etc.)                     │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Hooks 层 (React)                        │
│              useTTS()  /  useTTSQueue()                     │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                       队列层 (Queue)                         │
│                      TTSQueue Class                         │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                    ┌───────┴───────┐
                    │               │
┌───────────────────▼─┐   ┌────────▼────────────┐
│   Provider 层       │   │   缓存层 (Cache)     │
│   ExpoSpeech /      │   │   AudioCache        │
│   ElevenLabs        │   │                     │
└───────────────────┬─┘   └─────────────────────┘
                    │               │
                    │               │
                    └───────┬───────┘
                            │
┌───────────────────────────▼─────────────────────┐
│              核心层 (Core)                       │
│          constants / elevenLabsAPI              │
│          (纯函数，无副作用)                       │
└─────────────────────────────────────────────────┘
                            ▲
                            │
┌───────────────────────────▼─────────────────────┐
│            类型定义层 (Types)                     │
│          src/types/speak/                        │
│   common / provider / cache / queue             │
│   (所有 TypeScript 接口和类型)                    │
└─────────────────────────────────────────────────┘
```

### 🎨 架构特点

#### 1. 分层清晰

| 层级 | 职责 | 位置 | 依赖 | 特点 |
|------|------|------|------|------|
| **Types** | 所有 TypeScript 类型定义 | `src/types/speak/` | 无 | 类型安全，避免循环依赖，项目级共享 |
| **Core** | API 调用、常量 | `capabilities/speak/core/` | Types | 纯函数，可独立测试 |
| **Provider** | TTS 实现逻辑 | `capabilities/speak/providers/` | Types, Core | 可插拔，易扩展 |
| **Cache** | 音频缓存管理 | `capabilities/speak/cache/` | Types, Core | 独立模块，可选 |
| **Queue** | 队列和播放控制 | `capabilities/speak/queue/` | Types, Core, Provider, Cache | 核心业务逻辑 |
| **Hook** | React 集成 | `capabilities/speak/hooks/` | Types, Queue, Provider | UI 状态管理 |

#### 2. 单向依赖

- ✅ 高层依赖低层
- ✅ Types 层在项目级别，无任何依赖
- ✅ 避免循环依赖

#### 3. 项目级类型共享

- ✅ Types 位于 `src/types/speak/`，便于跨模块共享
- ✅ 其他模块（如 `listen`、`sense` 等）也可以引用
- ✅ 符合大型项目的最佳实践

#### 4. 接口驱动

- ✅ Provider 基于接口 `TTSProvider`
- ✅ 易于添加新 Provider (Google TTS, Azure TTS, etc.)
- ✅ 支持依赖注入和 Mock

---

## 5. 详细接口定义

### 5.1 Types Layer - 类型定义层

#### src/types/speak/common.ts - 通用类型

```typescript
// src/types/speak/common.ts

/**
 * TTS Provider type
 */
export type TTSProviderType = 'expo' | 'elevenlabs';

/**
 * TTS playback mode
 */
export type TTSMode = 'simple' | 'streaming';

/**
 * TTS queue item status
 */
export type TTSQueueStatus =
  | 'pending'       // Waiting for synthesis
  | 'synthesizing'  // Currently synthesizing
  | 'ready'         // Ready to play
  | 'playing'       // Currently playing
  | 'completed'     // Playback completed
  | 'failed';       // Synthesis or playback failed

/**
 * TTS queue item
 */
export interface TTSQueueItem {
  id: string;
  text: string;
  status: TTSQueueStatus;
  audioUri?: string;
  error?: string;
  retryCount?: number;
}

/**
 * TTS synthesis options
 */
export interface TTSSynthesisOptions {
  voiceId?: string;
  emotion?: string;
  language?: string;
  pitch?: number;
  rate?: number;
}

/**
 * TTS synthesis result
 */
export interface TTSSynthesisResult {
  audioUri: string;
  duration?: number;
}

/**
 * Audio cache entry
 */
export interface AudioCacheEntry {
  uri: string;
  text: string;
  lastAccessed: number;
  size: number;
}

/**
 * TTS configuration
 */
export interface TTSConfig {
  provider: TTSProviderType;
  mode: TTSMode;
  maxConcurrentSynthesis?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableCache?: boolean;
  fallbackToExpo?: boolean;
}
```

#### src/types/speak/provider.ts - Provider 接口

```typescript
// src/types/speak/provider.ts

import { TTSSynthesisOptions, TTSSynthesisResult } from './common';

/**
 * Base TTS Provider interface
 * All TTS providers must implement this interface
 */
export interface TTSProvider {
  /**
   * Provider name
   */
  readonly name: string;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Synthesize speech from text
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Audio file URI and metadata
   */
  synthesize(text: string, options?: TTSSynthesisOptions): Promise<TTSSynthesisResult>;

  /**
   * Play audio file
   * @param audioUri Audio file URI
   * @param callbacks Playback callbacks
   */
  play(
    audioUri: string,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void>;

  /**
   * Stop current playback
   */
  stop(): Promise<void>;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

/**
 * Provider factory type
 */
export type TTSProviderFactory = () => TTSProvider;
```

#### src/types/speak/cache.ts - 缓存接口

```typescript
// src/types/speak/cache.ts

import { AudioCacheEntry } from './common';

/**
 * Audio cache interface
 */
export interface IAudioCache {
  /**
   * Initialize cache
   */
  initialize(): Promise<void>;

  /**
   * Get cached audio
   * @param text Text key
   */
  get(text: string): Promise<AudioCacheEntry | null>;

  /**
   * Set cached audio
   * @param text Text key
   * @param uri Audio file URI
   */
  set(text: string, uri: string): Promise<void>;

  /**
   * Pre-cache common phrases
   * @param phrases Phrases to cache
   * @param synthesizeFn Synthesis function
   */
  preCachePhrases(
    phrases: string[],
    synthesizeFn: (text: string) => Promise<string>
  ): Promise<void>;

  /**
   * Clear all cache
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
  };
}
```

#### src/types/speak/queue.ts - 队列接口

```typescript
// src/types/speak/queue.ts

import { TTSQueueItem, TTSSynthesisOptions } from './common';

/**
 * TTS Queue configuration
 */
export interface TTSQueueConfig {
  maxConcurrentSynthesis?: number;
  maxRetries?: number;
  retryDelay?: number;
  onItemStart?: (item: TTSQueueItem) => void;
  onItemEnd?: (item: TTSQueueItem) => void;
  onItemError?: (item: TTSQueueItem, error: Error) => void;
}

/**
 * TTS Queue status
 */
export interface TTSQueueStatus {
  total: number;
  pending: number;
  synthesizing: number;
  ready: number;
  playing: number;
  completed: number;
  failed: number;
}

/**
 * TTS Queue interface
 */
export interface ITTSQueue {
  /**
   * Enqueue text for synthesis and playback
   * @param text Text to speak
   * @param options Synthesis options
   */
  enqueue(text: string, options?: TTSSynthesisOptions): Promise<void>;

  /**
   * Cancel all pending items
   */
  cancel(): Promise<void>;

  /**
   * Wait for all items to complete
   */
  waitForCompletion(): Promise<void>;

  /**
   * Get current queue status
   */
  getStatus(): TTSQueueStatus;
}
```

#### src/types/speak/index.ts - 统一类型导出

```typescript
// src/types/speak/index.ts

/**
 * Unified TTS type exports
 * All speak-related types are re-exported from this file for easy importing
 */

// Common types
export * from './common';

// Provider types
export * from './provider';

// Cache types
export * from './cache';

// Queue types
export * from './queue';
```

### 5.2 使用示例 - 导入类型

```typescript
// 从 capabilities/speak 模块导入类型（推荐方式）
import {
  TTSProviderType,
  TTSSynthesisOptions,
  TTSProvider,
  IAudioCache,
  ITTSQueue,
} from '../../../types/speak';

// 或者导入特定文件
import { TTSProvider } from '../../../types/speak/provider';
import { IAudioCache } from '../../../types/speak/cache';

// 从其他模块（如 capabilities/listen）导入 speak 类型
import { TTSSynthesisOptions } from '../../types/speak';
```

---

## 6. 代码示例

### 6.1 Core Layer 示例

#### core/elevenLabsAPI.ts

```typescript
// capabilities/speak/core/elevenLabsAPI.ts

import { File, Paths } from 'expo-file-system';
import {
  ELEVENLABS_CONFIG,
  getElevenLabsApiKey,
  getEmotionalVoiceSettings,
  getLanLanVoiceId,
  preprocessTextForNaturalSpeech,
} from '../../../constants/ai';
import { base64ToUint8Array, safeDeleteFile } from '../../../utils/fileSystemHelpers';
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
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  // Prepare request
  const voiceId = options?.voiceId || getLanLanVoiceId();
  const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voiceId}`;
  const voiceSettings = getEmotionalVoiceSettings(options?.emotion);
  const processedText = preprocessTextForNaturalSpeech(text);

  // Create temporary file
  const fileName = `elevenlabs_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
  const file = new File(Paths.document, fileName);
  file.create();

  try {
    // Make API request using XMLHttpRequest
    const audioUri = await makeElevenLabsRequest(url, apiKey, {
      text: processedText,
      model_id: ELEVENLABS_CONFIG.defaultModel,
      voice_settings: voiceSettings,
    }, file);

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
        await safeDeleteFile(file.uri);
        reject(new Error(`ElevenLabs API error: ${xhr.status}`));
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

### 6.2 Provider Layer 示例

#### providers/ElevenLabsProvider.ts

```typescript
// capabilities/speak/providers/ElevenLabsProvider.ts

import { TTSProvider, TTSSynthesisOptions, TTSSynthesisResult } from '../../../types/speak';
import { synthesizeWithElevenLabs } from '../core/elevenLabsAPI';
import { getElevenLabsApiKey } from '../../../constants/ai';
import { SoundPlayer } from '../soundPlayer';
import { audioModeManager } from '../../../utils/audioModeManager';

/**
 * ElevenLabs TTS Provider
 * Implements TTSProvider interface for ElevenLabs service
 */
export class ElevenLabsProvider implements TTSProvider {
  readonly name = 'elevenlabs';
  private soundPlayer: SoundPlayer;

  constructor() {
    this.soundPlayer = new SoundPlayer();
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = getElevenLabsApiKey();
    return !!apiKey;
  }

  async synthesize(
    text: string,
    options?: TTSSynthesisOptions
  ): Promise<TTSSynthesisResult> {
    return synthesizeWithElevenLabs(text, options);
  }

  async play(
    audioUri: string,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    // Set audio mode before playback
    await audioModeManager.setIdleMode();

    // Play using SoundPlayer
    await this.soundPlayer.play(audioUri, {
      onPlaybackStatusUpdate: (status) => {
        if (status.playing && callbacks?.onStart) {
          callbacks.onStart();
        }
      },
      onPlaybackFinished: () => {
        callbacks?.onEnd?.();
      },
      onError: (error) => {
        callbacks?.onError?.(error);
      },
    });
  }

  async stop(): Promise<void> {
    this.soundPlayer.stop();
  }

  async cleanup(): Promise<void> {
    this.soundPlayer.release();
  }
}
```

#### providers/ExpoSpeechProvider.ts

```typescript
// capabilities/speak/providers/ExpoSpeechProvider.ts

import * as Speech from 'expo-speech';
import { TTSProvider, TTSSynthesisOptions, TTSSynthesisResult } from '../../../types/speak';

/**
 * Expo Speech TTS Provider
 * Implements TTSProvider interface for Expo Speech service
 */
export class ExpoSpeechProvider implements TTSProvider {
  readonly name = 'expo';
  private isSpeaking = false;

  async isAvailable(): Promise<boolean> {
    // Expo Speech is always available
    return true;
  }

  async synthesize(
    text: string,
    options?: TTSSynthesisOptions
  ): Promise<TTSSynthesisResult> {
    // Expo Speech doesn't pre-generate audio files
    // Return a virtual URI that will be used in play()
    return {
      audioUri: `expo-speech://${encodeURIComponent(text)}`,
      duration: undefined,
    };
  }

  async play(
    audioUri: string,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    // Extract text from virtual URI
    const text = decodeURIComponent(audioUri.replace('expo-speech://', ''));

    return new Promise((resolve, reject) => {
      Speech.speak(text, {
        language: 'zh-CN',
        pitch: 1.0,
        rate: 0.8,
        onStart: () => {
          this.isSpeaking = true;
          callbacks?.onStart?.();
        },
        onDone: () => {
          this.isSpeaking = false;
          callbacks?.onEnd?.();
          resolve();
        },
        onStopped: () => {
          this.isSpeaking = false;
          callbacks?.onEnd?.();
          resolve();
        },
        onError: (error) => {
          this.isSpeaking = false;
          const err = new Error(`Expo Speech error: ${error}`);
          callbacks?.onError?.(err);
          reject(err);
        },
      });
    });
  }

  async stop(): Promise<void> {
    Speech.stop();
    this.isSpeaking = false;
  }

  async cleanup(): Promise<void> {
    await this.stop();
  }
}
```

### 6.3 Hook Layer 示例

#### hooks/useTTS.ts

```typescript
// capabilities/speak/hooks/useTTS.ts

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  TTSConfig,
  TTSProviderType,
  TTSSynthesisOptions,
  TTSProvider,
} from '../../../types/speak';
import { ElevenLabsProvider } from '../providers/ElevenLabsProvider';
import { ExpoSpeechProvider } from '../providers/ExpoSpeechProvider';

/**
 * useTTS Hook return type
 */
export interface UseTTSReturn {
  isSpeaking: boolean;
  isGenerating: boolean;
  error: string | null;
  currentProvider: TTSProviderType;
  speak(text: string, options?: TTSSynthesisOptions): Promise<void>;
  speakStream(
    textStream: AsyncGenerator<string>,
    options?: TTSSynthesisOptions
  ): Promise<void>;
  stop(): Promise<void>;
  switchProvider(provider: TTSProviderType): void;
}

/**
 * Unified TTS Hook
 * Supports both simple and streaming modes
 */
export function useTTS(config?: Partial<TTSConfig>): UseTTSReturn {
  // State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<TTSProviderType>(
    config?.provider || 'elevenlabs'
  );

  // Provider instances
  const providersRef = useRef<Map<TTSProviderType, TTSProvider>>(new Map());

  // Initialize providers
  useEffect(() => {
    const providers = providersRef.current;
    providers.set('elevenlabs', new ElevenLabsProvider());
    providers.set('expo', new ExpoSpeechProvider());

    return () => {
      // Cleanup on unmount
      providers.forEach((provider) => provider.cleanup());
      providers.clear();
    };
  }, []);

  // Get current provider instance
  const getProvider = useCallback((): TTSProvider => {
    const provider = providersRef.current.get(currentProvider);
    if (!provider) {
      throw new Error(`Provider ${currentProvider} not initialized`);
    }
    return provider;
  }, [currentProvider]);

  // Simple speak
  const speak = useCallback(
    async (text: string, options?: TTSSynthesisOptions) => {
      if (!text.trim()) return;

      try {
        setError(null);
        setIsGenerating(true);

        const provider = getProvider();

        // Synthesize
        const result = await provider.synthesize(text, options);
        setIsGenerating(false);

        // Play
        await provider.play(result.audioUri, {
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: (err) => {
            setError(err.message);
            setIsSpeaking(false);
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'TTS failed');
        setIsGenerating(false);
        setIsSpeaking(false);

        // Fallback to Expo if configured
        if (config?.fallbackToExpo && currentProvider === 'elevenlabs') {
          console.warn('ElevenLabs failed, falling back to Expo Speech');
          setCurrentProvider('expo');
          await speak(text, options);
        }
      }
    },
    [currentProvider, config?.fallbackToExpo, getProvider]
  );

  // Streaming speak (placeholder for future implementation)
  const speakStream = useCallback(
    async (
      textStream: AsyncGenerator<string>,
      options?: TTSSynthesisOptions
    ) => {
      // TODO: Implement streaming using TTSQueue
      throw new Error('Streaming not yet implemented in this version');
    },
    []
  );

  // Stop
  const stop = useCallback(async () => {
    try {
      const provider = getProvider();
      await provider.stop();
      setIsSpeaking(false);
      setIsGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stop failed');
    }
  }, [getProvider]);

  // Switch provider
  const switchProvider = useCallback(
    (provider: TTSProviderType) => {
      stop();
      setCurrentProvider(provider);
    },
    [stop]
  );

  return {
    isSpeaking,
    isGenerating,
    error,
    currentProvider,
    speak,
    speakStream,
    stop,
    switchProvider,
  };
}
```

### 6.4 使用示例

#### Simple Mode - 简单播放

```typescript
import { useTTS } from './capabilities/speak';

function MyComponent() {
  const tts = useTTS({
    provider: 'elevenlabs',
    fallbackToExpo: true,
  });

  const handleSpeak = async () => {
    await tts.speak('你好，我是兰兰', {
      emotion: 'happy',
    });
  };

  return (
    <View>
      <Button
        title={tts.isSpeaking ? "Speaking..." : "Speak"}
        onPress={handleSpeak}
        disabled={tts.isSpeaking}
      />
      {tts.error && <Text>{tts.error}</Text>}
    </View>
  );
}
```

#### Streaming Mode - 流式播放 (Future)

```typescript
import { useTTS } from './capabilities/speak';

function ChatComponent() {
  const tts = useTTS({
    provider: 'elevenlabs',
    mode: 'streaming',
  });

  const handleStreamingSpeak = async () => {
    // Simulate AI response stream
    async function* textStream() {
      yield "你好，";
      await delay(100);
      yield "我是兰兰。";
      await delay(100);
      yield "今天天气很好呢~";
    }

    await tts.speakStream(textStream(), {
      emotion: 'gentle',
    });
  };

  return (
    <View>
      <Button
        title="Stream Speak"
        onPress={handleStreamingSpeak}
      />
      {tts.isGenerating && <Text>Generating...</Text>}
      {tts.isSpeaking && <Text>Speaking...</Text>}
    </View>
  );
}
```

---

## 7. 迁移步骤

### Phase 1: 创建类型和核心层 (2-3 小时)

#### Step 1.1: 创建类型定义层（项目级）

```bash
# 创建项目级 types/speak 目录
mkdir -p src/types/speak

# 创建所有类型文件
touch src/types/speak/index.ts
touch src/types/speak/common.ts
touch src/types/speak/provider.ts
touch src/types/speak/cache.ts
touch src/types/speak/queue.ts
```

**任务清单**:
- [ ] 创建 `src/types/speak/common.ts` - 从 `ttsQueue.ts` 和 `useElevenLabsTTS.ts` 提取通用类型
  - TTSProviderType, TTSMode, TTSQueueStatus
  - TTSQueueItem, TTSSynthesisOptions, TTSSynthesisResult
  - AudioCacheEntry, TTSConfig
- [ ] 创建 `src/types/speak/provider.ts` - Provider 接口定义
  - TTSProvider interface
  - TTSProviderFactory type
- [ ] 创建 `src/types/speak/cache.ts` - 缓存接口定义
  - IAudioCache interface
- [ ] 创建 `src/types/speak/queue.ts` - 队列接口定义
  - TTSQueueConfig, TTSQueueStatus interfaces
  - ITTSQueue interface
- [ ] 创建 `src/types/speak/index.ts` - 统一导出所有类型
- [ ] 统一命名规范，添加完整的 JSDoc 注释

**重要提示**:
- Types 放在项目级 `src/types/speak/`，便于跨模块共享
- 从 `capabilities/speak` 导入时使用 `../../../types/speak`

#### Step 1.2: 创建核心常量定义

```bash
touch src/capabilities/speak/core/constants.ts
```

**任务清单**:
- [ ] 从 `ttsQueue.ts` 提取 `CACHE_PHRASES`
- [ ] 添加其他 TTS 相关常量
- [ ] 导出为 `const` 而非 `let`

#### Step 1.3: 创建 ElevenLabs API 模块

```bash
touch src/capabilities/speak/core/elevenLabsAPI.ts
```

**任务清单**:
- [ ] 合并 `ttsQueue.ts:411-489` 和 `useElevenLabsTTS.ts:63-139`
- [ ] 创建 `synthesizeWithElevenLabs()` 纯函数
- [ ] 添加错误处理和重试逻辑
- [ ] 编写单元测试

**验证**:
```typescript
// Test in isolation
import { synthesizeWithElevenLabs } from './core/elevenLabsAPI';
import { TTSSynthesisOptions } from '../../../types/speak';

const result = await synthesizeWithElevenLabs('测试', {
  emotion: 'happy',
} as TTSSynthesisOptions);
console.log('Audio URI:', result.audioUri);
```

### Phase 2: 创建 Provider 层 (2-3 小时)

#### Step 2.1: 创建 Provider 目录

```bash
mkdir -p src/capabilities/speak/providers
```

**说明**: Provider 接口已在 Phase 1 中的 `src/types/speak/provider.ts` 创建，此阶段只需创建实现类。

#### Step 2.2: 实现 ElevenLabsProvider

```bash
touch src/capabilities/speak/providers/ElevenLabsProvider.ts
```

**任务清单**:
- [ ] 基于 `useElevenLabsTTS.ts` 创建 Provider
- [ ] 使用 `core/elevenLabsAPI.ts` 的 API
- [ ] 集成 `SoundPlayer`
- [ ] 实现所有接口方法

#### Step 2.3: 实现 ExpoSpeechProvider

```bash
touch src/capabilities/speak/providers/ExpoSpeechProvider.ts
```

**任务清单**:
- [ ] 基于 `useTTS.ts` 创建 Provider
- [ ] 实现虚拟 URI 机制
- [ ] 实现所有接口方法

**验证**:
```typescript
// Test providers
const elevenLabs = new ElevenLabsProvider();
const expo = new ExpoSpeechProvider();

await elevenLabs.play(audioUri);
await expo.play('expo-speech://你好');
```

### Phase 3: 重构缓存和队列 (2-3 小时)

#### Step 3.1: 提取缓存模块

```bash
mkdir -p src/capabilities/speak/cache
touch src/capabilities/speak/cache/AudioCache.ts
```

**任务清单**:
- [ ] 从 `ttsQueue.ts` 提取 `TTSAudioCache` 类 (64-199 行)
- [ ] 实现 `IAudioCache` 接口（定义在 `src/types/speak/cache.ts`）
- [ ] 使用 `src/types/speak/` 的类型定义
- [ ] 导入路径：`import { IAudioCache, AudioCacheEntry } from '../../../types/speak'`
- [ ] 保持原有功能不变

**说明**: 缓存接口已在 Phase 1 中的 `src/types/speak/cache.ts` 创建。

#### Step 3.2: 重构 TTSQueue

```bash
mkdir -p src/capabilities/speak/queue
touch src/capabilities/speak/queue/TTSQueue.ts
```

**说明**: 队列接口已在 Phase 1 中的 `src/types/speak/queue.ts` 创建。

**任务清单**:
- [ ] 从 `ttsQueue.ts` 提取 `TTSQueue` 类 (236-690 行)
- [ ] 移除内部的 `callElevenLabsTTS` 方法
- [ ] 使用 `ElevenLabsProvider` 进行合成
- [ ] 使用 `AudioCache` 进行缓存
- [ ] 保持队列逻辑不变

**重构示例**:
```typescript
// Before (ttsQueue.ts):
const audioUri = await this.callElevenLabsTTS(item.text);

// After (queue/TTSQueue.ts):
const provider = new ElevenLabsProvider();
const result = await provider.synthesize(item.text, options);
const audioUri = result.audioUri;
```

### Phase 4: 创建新 Hooks (1-2 小时)

#### Step 4.1: 创建 useTTS Hook

```bash
mkdir -p src/capabilities/speak/hooks
touch src/capabilities/speak/hooks/useTTS.ts
```

**任务清单**:
- [ ] 创建统一的 `useTTS` Hook
- [ ] 支持简单播放模式
- [ ] 支持 Provider 切换
- [ ] 集成错误处理和状态管理

#### Step 4.2: 创建 useTTSQueue Hook (可选)

```bash
touch src/capabilities/speak/hooks/useTTSQueue.ts
```

**任务清单**:
- [ ] 封装 `TTSQueue` 为 Hook
- [ ] 管理队列生命周期
- [ ] 提供队列状态

### Phase 5: 迁移现有代码 (2-3 小时)

#### Step 5.1: 更新 useChatAI.ts

**当前使用**:
```typescript
import { useHybridTTS } from '../capabilities/speak/useHybridTTS';
import { TTSQueue } from '../capabilities/speak/ttsQueue';

const tts = useHybridTTS({ ... });
const ttsQueueRef = useRef(new TTSQueue({ ... }));
```

**迁移后**:
```typescript
import { useTTS } from '../capabilities/speak';

const tts = useTTS({
  provider: 'elevenlabs',
  mode: 'streaming',
  fallbackToExpo: true,
});

// 使用统一的 API
await tts.speakStream(textGenerator, { emotion });
```

**任务清单**:
- [ ] 替换 `useHybridTTS` 为 `useTTS`
- [ ] 移除 `TTSQueue` 的直接使用
- [ ] 更新所有 TTS 调用
- [ ] 测试流式播放功能

#### Step 5.2: 更新 App.tsx

**当前使用**:
```typescript
import { initializeTTSCache, preCacheCommonPhrases } from './src/capabilities/speak/ttsQueue';
```

**迁移后**:
```typescript
import { initializeTTSCache, preCacheCommonPhrases } from './src/capabilities/speak';
```

**任务清单**:
- [ ] 更新导入路径
- [ ] 验证缓存初始化功能
- [ ] 测试预缓存功能

#### Step 5.3: 删除旧文件

```bash
# 备份旧文件
mkdir -p src/capabilities/speak/_old_backup
mv src/capabilities/speak/useElevenLabsTTS.ts src/capabilities/speak/_old_backup/
mv src/capabilities/speak/useHybridTTS.ts src/capabilities/speak/_old_backup/
mv src/capabilities/speak/useTTS.ts src/capabilities/speak/_old_backup/
mv src/capabilities/speak/ttsQueue.ts src/capabilities/speak/_old_backup/

# 确认一切正常后删除
rm -rf src/capabilities/speak/_old_backup/
```

**任务清单**:
- [ ] 备份旧文件
- [ ] 运行完整测试
- [ ] 确认无依赖后删除

#### Step 5.4: 创建统一导出

```bash
touch src/capabilities/speak/index.ts
```

```typescript
// src/capabilities/speak/index.ts

// Types - Re-export all types from project-level types folder
export * from '../../types/speak';

// Hooks
export { useTTS } from './hooks/useTTS';
export type { UseTTSReturn } from './hooks/useTTS';

// Utils
export { initializeTTSCache, preCacheCommonPhrases } from './cache/AudioCache';

// Constants
export { CACHE_PHRASES } from './core/constants';
```

**说明**:
- Types 从 `../../types/speak` 重新导出，便于外部模块使用
- 外部模块可以通过 `import { TTSProvider } from './capabilities/speak'` 导入类型

---

## 8. 风险评估

### 🔴 高风险

#### 风险 1: 破坏现有功能

**描述**: 重构过程中可能影响 `useChatAI.ts` 的流式播放功能

**影响**: 用户无法正常使用 AI 对话

**缓解措施**:
- ✅ 在新分支上进行重构
- ✅ Phase 1-3 不修改现有文件，只创建新模块
- ✅ Phase 4 先保留旧代码，新旧并存
- ✅ Phase 5 充分测试后再删除旧代码

**回滚计划**:
- 保留 `_old_backup/` 目录直到测试通过
- Git 分支保护，可快速回滚

#### 风险 2: API 不兼容

**描述**: 新 API 可能与现有调用不兼容

**影响**: 需要修改多处调用代码

**缓解措施**:
- ✅ 提供兼容层 (Adapter Pattern)
- ✅ 渐进式迁移，一次只改一个文件
- ✅ 编写详细的迁移文档

### 🟡 中风险

#### 风险 3: 音频缓存失效

**描述**: 缓存模块重构可能导致缓存失效

**影响**: 失去预缓存的常用短语，性能下降

**缓解措施**:
- ✅ 保持缓存数据格式不变
- ✅ 提供缓存迁移工具
- ✅ 最坏情况下重新预缓存 (1-2 分钟)

#### 风险 4: 性能回退

**描述**: 新架构可能引入性能开销

**影响**: TTS 响应延迟增加

**缓解措施**:
- ✅ 在重构过程中保持性能监控
- ✅ Provider 接口不增加额外抽象层
- ✅ 使用 `useRef` 避免不必要的重渲染

### 🟢 低风险

#### 风险 5: 类型定义冲突

**描述**: 新旧类型定义可能产生冲突

**影响**: TypeScript 编译错误

**缓解措施**:
- ✅ 使用不同的命名空间或前缀
- ✅ 编译时检查，易于发现和修复

---

## 9. 测试策略

### 9.1 单元测试

#### Core Layer

```typescript
// core/elevenLabsAPI.test.ts

describe('synthesizeWithElevenLabs', () => {
  it('should synthesize speech successfully', async () => {
    const result = await synthesizeWithElevenLabs('测试');
    expect(result.audioUri).toMatch(/\.mp3$/);
  });

  it('should throw error if API key missing', async () => {
    // Mock getElevenLabsApiKey to return null
    await expect(synthesizeWithElevenLabs('测试')).rejects.toThrow();
  });

  it('should apply emotion settings', async () => {
    const result = await synthesizeWithElevenLabs('测试', {
      emotion: 'happy',
    });
    // Verify emotion settings applied
  });
});
```

#### Provider Layer

```typescript
// providers/ElevenLabsProvider.test.ts

describe('ElevenLabsProvider', () => {
  let provider: ElevenLabsProvider;

  beforeEach(() => {
    provider = new ElevenLabsProvider();
  });

  afterEach(async () => {
    await provider.cleanup();
  });

  it('should implement TTSProvider interface', () => {
    expect(provider.name).toBe('elevenlabs');
    expect(provider.synthesize).toBeDefined();
    expect(provider.play).toBeDefined();
  });

  it('should synthesize and play', async () => {
    const result = await provider.synthesize('你好');
    await provider.play(result.audioUri);
    // Verify playback
  });
});
```

### 9.2 集成测试

```typescript
// hooks/useTTS.integration.test.ts

describe('useTTS integration', () => {
  it('should speak using ElevenLabs', async () => {
    const { result } = renderHook(() => useTTS({ provider: 'elevenlabs' }));

    await act(async () => {
      await result.current.speak('你好');
    });

    expect(result.current.isSpeaking).toBe(true);
  });

  it('should fallback to Expo on error', async () => {
    // Mock ElevenLabs to fail
    const { result } = renderHook(() => useTTS({
      provider: 'elevenlabs',
      fallbackToExpo: true,
    }));

    await act(async () => {
      await result.current.speak('你好');
    });

    expect(result.current.currentProvider).toBe('expo');
  });
});
```

### 9.3 手动测试清单

#### 基础功能
- [ ] 简单播放 - ElevenLabs
- [ ] 简单播放 - Expo Speech
- [ ] 停止播放
- [ ] Provider 切换
- [ ] 错误处理

#### 高级功能
- [ ] 流式播放 (useChatAI.ts)
- [ ] 音频缓存命中
- [ ] 音频缓存未命中
- [ ] 预缓存常用短语
- [ ] 队列管理 (多句话)

#### 边界情况
- [ ] 空文本
- [ ] 超长文本 (1000+ 字符)
- [ ] 特殊字符
- [ ] 网络错误
- [ ] API key 缺失

#### 性能测试
- [ ] 首次播放延迟 < 2s
- [ ] 缓存播放延迟 < 100ms
- [ ] 队列处理效率
- [ ] 内存占用

---

## 10. 时间估算

### 详细时间分配

| Phase | 任务 | 预计时间 | 累计时间 |
|-------|------|----------|----------|
| **Phase 1** | 创建核心层 | | |
| 1.1 | 类型定义 | 0.5h | 0.5h |
| 1.2 | 常量定义 | 0.5h | 1.0h |
| 1.3 | ElevenLabs API | 1.5h | 2.5h |
| **Phase 2** | 创建 Provider 层 | | |
| 2.1 | Provider 接口 | 0.5h | 3.0h |
| 2.2 | ElevenLabsProvider | 1.5h | 4.5h |
| 2.3 | ExpoSpeechProvider | 1.0h | 5.5h |
| **Phase 3** | 重构缓存和队列 | | |
| 3.1 | 提取缓存模块 | 1.0h | 6.5h |
| 3.2 | 重构 TTSQueue | 2.0h | 8.5h |
| **Phase 4** | 创建新 Hooks | | |
| 4.1 | useTTS Hook | 1.5h | 10.0h |
| 4.2 | useTTSQueue Hook | 0.5h | 10.5h |
| **Phase 5** | 迁移现有代码 | | |
| 5.1 | 更新 useChatAI.ts | 1.5h | 12.0h |
| 5.2 | 更新 App.tsx | 0.5h | 12.5h |
| 5.3 | 删除旧文件 | 0.5h | 13.0h |
| **测试** | | | |
| - | 单元测试 | 2.0h | 15.0h |
| - | 集成测试 | 1.5h | 16.5h |
| - | 手动测试 | 1.5h | 18.0h |
| **文档** | | | |
| - | 更新 README | 0.5h | 18.5h |
| - | API 文档 | 1.0h | 19.5h |

### 总计

- **最佳情况**: 16 小时 (一切顺利)
- **预期情况**: 19.5 小时 (正常开发)
- **最坏情况**: 24 小时 (遇到问题需要调试)

### 建议的执行周期

**选项 A: 集中重构** (2-3 天)
- Day 1: Phase 1-2 (核心层 + Provider)
- Day 2: Phase 3-4 (缓存队列 + Hooks)
- Day 3: Phase 5 + 测试 (迁移 + 测试)

**选项 B: 渐进重构** (1-2 周)
- Week 1: Phase 1-3 (核心、Provider、缓存队列)
  - 新旧代码并存，充分测试
- Week 2: Phase 4-5 (Hooks + 迁移)
  - 逐步替换旧代码

**推荐**: 选项 B - 渐进重构，风险更低

---

## 11. 成功标准

### ✅ 功能标准

- [ ] 所有现有 TTS 功能正常工作
- [ ] 简单播放模式可用
- [ ] 流式播放模式可用
- [ ] 音频缓存功能正常
- [ ] Provider 切换无误

### ✅ 代码质量标准

- [ ] 无代码重复 (DRY)
- [ ] 所有文件 < 300 行
- [ ] TypeScript 无编译错误
- [ ] ESLint 无警告
- [ ] 100% 类型覆盖

### ✅ 性能标准

- [ ] 首次播放延迟 < 2s
- [ ] 缓存播放延迟 < 100ms
- [ ] 内存使用无明显增加
- [ ] 无内存泄漏

### ✅ 测试标准

- [ ] 核心函数单元测试覆盖 > 80%
- [ ] Provider 测试覆盖 > 70%
- [ ] 所有手动测试清单通过

### ✅ 文档标准

- [ ] API 文档完整
- [ ] 使用示例清晰
- [ ] 迁移指南详细
- [ ] CHANGELOG 更新

---

## 12. 后续优化

### 短期优化 (1-2 周)

- [ ] 添加更多单元测试
- [ ] 性能监控和优化
- [ ] 错误日志和分析
- [ ] 添加更多 Provider (Google TTS, Azure TTS)

### 中期优化 (1-2 月)

- [ ] 实现真正的流式播放 API
- [ ] 添加音频效果 (变速、变调)
- [ ] 支持多语言 TTS
- [ ] 离线 TTS 支持

### 长期优化 (3-6 月)

- [ ] TTS 质量评估系统
- [ ] 自适应 Provider 选择
- [ ] TTS 个性化定制
- [ ] 实时语音克隆

---

## 13. 附录

### A. 相关文档

- [EmoMate CLAUDE.md](./CLAUDE.md) - 项目总览
- [PROGRESS.md](../PROGRESS.md) - 项目进度
- [ElevenLabs API 文档](https://elevenlabs.io/docs) - 官方 API 文档

### B. 技术参考

- [React Hooks 最佳实践](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [TypeScript 类型设计](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [依赖注入模式](https://en.wikipedia.org/wiki/Dependency_injection)

### C. 联系方式

如有疑问，请联系:
- 项目负责人: [Your Name]
- 技术支持: [Your Email]

---

## 14. 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0.0 | 2025-01-14 | Claude | 初始版本 - 完整重构计划 |

---

**文档状态**: 📝 待审核
**下一步**: 等待项目负责人审核批准后执行 Phase 1

---

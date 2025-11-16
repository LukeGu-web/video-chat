# 架构设计

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

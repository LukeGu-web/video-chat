# Video-Chat 项目全面探索报告

**报告日期**: 2026-02-19
**项目状态**: 🚀 生产就绪 (92%)
**代码行数**: ~24,000 行 (EmoMate TypeScript/TSX，相比 2025-01-21 的 ~6,300 行增长约 4 倍)

---

## 📋 目录

1. [项目概述](#项目概述)
2. [EmoMate - 架构全景](#emomate---架构全景)
3. [核心功能模块](#核心功能模块)
   - 3.1 语音对话系统
   - 3.2 TTS 系统（新架构）
   - 3.3 四层记忆系统
   - 3.4 视觉与环境感知系统
   - 3.5 RAG 检索增强系统
   - 3.6 情绪检测系统
   - 3.7 主动对话系统
   - 3.8 Live2D 动作系统
   - 3.9 人格与个性化系统
4. [Character - 网页应用](#character---网页应用)
5. [技术栈](#技术栈)
6. [状态管理体系](#状态管理体系)
7. [已知技术债务与待优化项](#已知技术债务与待优化项)
8. [开发指南](#开发指南)

---

## 项目概述

**Video-Chat** 是一个以 Live2D 角色为核心的多模态 AI 伴侣应用，集成了语音对话、持久记忆、环境感知、检索增强生成（RAG）等能力。

### 主要里程碑（2025-01-21 → 2026-02-19）

| 里程碑 | 状态 |
|--------|------|
| 重构为 Capabilities 模块架构 | ✅ |
| 四层持久记忆系统（MMKV + SQLite） | ✅ |
| RAG 检索增强生成系统 | ✅ |
| 视觉环境感知（Claude Vision + MLKit） | ✅ |
| TTS 系统重构（TTSQueue + 并行合成） | ✅ |
| Prompt Caching 成本优化 | ✅ |
| 双语支持（中英文自动切换） | ✅ |
| 对话摘要与用户反馈系统 | ✅ |

### 项目结构

```
video-chat/
├── EmoMate/                    # React Native 移动应用
│   ├── src/
│   │   ├── capabilities/       # 能力模块层（新架构）
│   │   │   ├── emotion/        # 情绪状态管理
│   │   │   ├── listen/         # 语音识别
│   │   │   ├── motion/         # 动作选择器
│   │   │   ├── retrieval/      # RAG 检索管道
│   │   │   ├── speak/          # TTS（队列、提供者、缓存）
│   │   │   └── vision/         # 相机、面部检测、场景理解、物体识别
│   │   ├── components/         # UI 组件（20+ 个）
│   │   ├── hooks/              # React 自定义 hooks（15+）
│   │   │   └── ai/             # AI 专用 hooks
│   │   ├── screens/            # 4 个屏幕（含新增 SceneHistoryScreen）
│   │   ├── store/              # Zustand 状态管理（9 个 store）
│   │   ├── types/              # TypeScript 类型定义
│   │   ├── constants/          # 配置常量（ai.ts 1298 行）
│   │   └── utils/              # 工具函数
│   └── App.tsx                 # 根组件（音频配置 + TTS 预热 + 记忆 hydration）
├── character/                  # Remix 网页应用（Live2D）
└── CLAUDE.md
```

---

## EmoMate - 架构全景

### 版本信息（最新）

| 依赖 | 版本 |
|------|------|
| Expo SDK | 54 |
| React Native | 0.81.5 |
| React | 19.1.0 |
| TypeScript | 5.9.2 |
| expo-sqlite | ~16.0.10（新增） |
| react-native-mmkv | ^4.0.0 |

### Capabilities 模块架构

旧架构将所有逻辑平铺在 `src/utils/`，新架构按能力领域划分到 `src/capabilities/`：

```
capabilities/
├── emotion/
│   ├── emotionAnalysis.ts     # 情绪分析算法
│   ├── useEmotionState.ts     # 情绪状态 hook
│   └── index.ts
├── listen/
│   ├── useSpeechToText.ts     # 语音识别
│   └── index.ts
├── motion/
│   ├── motionMapper.ts        # 上下文感知动作选择器（398 行）
│   └── index.ts
├── retrieval/
│   ├── ragPipeline.ts         # RAG 主管道
│   ├── queryAnalyzer.ts       # 查询分析
│   ├── multiSourceRetriever.ts
│   ├── contextBuilder.ts      # 上下文构建
│   ├── relevanceScoring.ts    # 相关性评分（295 行）
│   ├── conversationSummarizer.ts  # 对话摘要（341 行）
│   ├── userFeedback.ts        # 用户反馈（326 行）
│   ├── performanceMonitor.ts  # 性能监控
│   └── index.ts
├── speak/
│   ├── queue/TTSQueue.ts      # TTS 队列管理（413 行）
│   ├── providers/
│   │   ├── ElevenLabsProvider.ts
│   │   └── ExpoSpeechProvider.ts
│   ├── cache/AudioCache.ts    # 音频文件缓存
│   ├── elevenLabsAPI.ts       # ElevenLabs API 封装
│   ├── sentenceDetector.ts    # SSE 流式句子检测
│   ├── smartSentenceBuffer.ts # 智能句子过滤（377 行）
│   └── index.ts
└── vision/
    ├── camera/
    │   ├── useCamera.ts
    │   └── useCameraPermissions.ts
    ├── faceDetection/
    │   ├── useFaceDetection.ts    # MLKit 1.9.0 面部检测
    │   ├── emotionAlgorithm.ts    # 情绪推断算法
    │   ├── faceFeatures.ts        # 面部特征提取
    │   └── worklets.ts            # Reanimated worklets
    ├── environment/
    │   ├── useSceneUnderstanding.ts  # 场景理解主 hook（816 行）
    │   ├── buildScenePrompt.ts       # 场景提示词构建（333 行）
    │   ├── sceneAnalysis.ts          # 核心分析逻辑
    │   ├── sceneCache.ts             # 场景数据缓存
    │   ├── sceneTimer.ts             # 定时器逻辑
    │   └── sceneKeywords.ts          # 关键词检测（280 行）
    ├── object/
    │   └── useObjectRecognition.ts
    ├── claudeVision.ts            # Claude Vision API（713 行）
    ├── imageComparison.ts         # 图像变化检测（301 行）
    ├── imageCompression.ts        # 图像压缩
    └── index.ts
```

---

## 核心功能模块

### 3.1 语音对话系统

**文件**: `src/hooks/useChatAI.ts`（658 行）

✅ **Claude AI 集成（含 Prompt Caching）**
- 模型: claude-haiku-4-5 / claude-sonnet-4-6
- 流式 SSE 响应
- `cache_control: { type: 'ephemeral' }` 应用于稳定的系统提示块（人格 + 情绪响应块），降低 API 成本
- `buildCacheableAPIRequestConfig()` 统一构建带缓存控制的请求配置

✅ **RAG 集成**
```typescript
const ragResult = await executeRAG(userMessage, chatHistory, { enableRetrieval: true });
// ragResult.context 注入到系统提示
```

✅ **智能对话类型检测**
| 类型 | 字符数 | Max Tokens | 触发条件 |
|------|--------|------------|----------|
| simple | 20-50 | 80 | 问候、确认 |
| normal | 50-120 | 150 | 日常聊天 |
| detailed | 120-300 | 300 | 解释性内容 |
| storytelling | 200-500 | 500 | 故事、剧情 |

---

### 3.2 TTS 系统（capabilities/speak/）

**核心设计**：`TTSQueue` — 并行合成 + 顺序播放

```
文本 → sentenceDetector（SSE 流切句） → TTSQueue.enqueue()
                                              ↓
                               并行合成（最多 2 个并发）
                               ElevenLabsProvider / AudioCache
                                              ↓
                                     顺序播放音频文件
```

✅ **TTSQueue 特性**（`queue/TTSQueue.ts`, 413 行）
- 最多 2 个并发合成任务（避免 rate limit）
- 最多 3 次重试
- 支持 `cancel()`、`waitForCompletion()`
- 完成回调和状态追踪

✅ **AudioCache**（`cache/AudioCache.ts`）
- 本地文件缓存避免重复合成
- App 启动时预热 TTS（`App.tsx`）

✅ **语音配置**
- Voice ID: `hkfHEbBvdQFNX4uWHqRF`
- 情绪感知语音参数:

| 情绪 | stability | similarity_boost | style |
|------|-----------|-----------------|-------|
| gentle | 0.4 | 0.7 | 0.25 |
| happy | 0.3 | 0.65 | 0.4 |
| caring | 0.6 | 0.8 | 0.2 |
| shy | 0.45 | 0.75 | 0.35 |

---

### 3.3 四层记忆系统

**设计目标**: 让 LanLan 跨 session 记住用户，对话有连续感。

```
Layer 1 (MMKV) ── UserProfile ──────── 用户基本信息（name, occupation, tags, language）
Layer 2 (MMKV) ── UserPreferences ──── 偏好设置（wantsAdvice, prefersHumor, replyLength）
Layer 3 (SQLite) ─ episodes ──────────  对话摘要（每次 ≤100 字，记录话题、情绪、关键事件）
Layer 4 (SQLite) ─ facts ────────────── 知识事实（category, importance, expiresAt）
```

✅ **提取触发器**（`useMemoryTriggers.ts`）
- 消息计数：每 20 条提取一次
- 沉默：5 分钟无新消息
- 后台：App 进入 background 时标记 pending
- 启动：App 重启时处理上次未完成的 pending extraction

✅ **提取流程**（`useMemoryExtraction.ts`）
```
对话片段 → Claude Haiku（1024 max_tokens）→ ExtractionResult JSON
                                                    ↓
                              updateProfile + updatePreferences（MMKV）
                              insertEpisode + insertFact（SQLite）
```

✅ **注入流程**（`buildMemoryContext.ts` → `buildAIContext.ts`）
```typescript
const { memoryBlock } = buildMemoryContext(profile, preferences);
// memoryBlock 注入系统提示（非缓存块，每次对话都更新）
```

✅ **话题种子**（`useTopicSeeds.ts`）
- 3 天内即将过期的高重要度 facts → 提问话题
- 1 天前情绪低落的 episode → 关怀话题
- 最新 episode 的 keyEvents → 后续跟进话题
- 仅在 `messages.length === 0` 时作为 proactive message 的备用兜底

✅ **App.tsx 集成**
```typescript
const loadFromStorage = useMemoryStore((s) => s.loadFromStorage);
useEffect(() => { loadFromStorage(); }, [loadFromStorage]);
// 在所有子 Screen 渲染前完成 MMKV hydration
```

---

### 3.4 视觉与环境感知系统

**核心文件**: `capabilities/vision/` 目录

#### 场景理解（useSceneUnderstanding.ts, 816 行）

✅ **工作流程**
```
相机帧捕获 → 图像压缩 → 变化检测（imageComparison）
    ↓ 有足够变化时
Claude Vision API（claudeVision.ts）
    ↓
SceneData（location, lighting, objects, mood, activities）
    ↓
sceneStore + AI 系统提示注入
```

✅ **触发机制**
- 定时分析（可配置间隔）
- 关键词触发（用户提到场景相关词汇）
- 场景变化触发（图像差异超过阈值）
- 对话活跃期降低分析频率

✅ **场景缓存**（`sceneCache.ts`）
- 持久化到 MMKV，跨 session 保留
- 语义去重（相似场景不重复分析）

#### 物体识别（useObjectRecognition.ts）

✅ **高优先级注入**
```typescript
// 物体识别结果以强调标记注入 AI 上下文
objectRecognitionContext: `[USER IS SHOWING YOU: ${result}]`
```

#### 面部情绪检测（faceDetection/）

✅ **MLKit 1.9.0 集成**
- `useFaceDetection` + Reanimated worklet 处理帧
- 60fps 实时检测
- 情绪算法（`emotionAlgorithm.ts`）:

```
smilingProbability > 0.6                 → joy (开心)
eyeOpen > 0.8 && smile < 0.3            → surprise (惊讶)
eyeOpen < 0.4 && smile < 0.2            → sadness (难过)
smile < 0.1 && eyeOpen > 0.5            → anger (生气)
其他                                      → neutral (中立)
```

#### 动态背景系统

✅ **Background Scenes**（`constants/backgroundScenes.ts`, 721 行）
- 基于对话内容和场景分析动态切换背景图
- `useBackgroundSceneManager` 整合多个触发条件

---

### 3.5 RAG 检索增强生成系统

**文件**: `capabilities/retrieval/` (8 个模块)

```
用户消息
    ↓
queryAnalyzer.ts ──── 分析查询意图和关键词
    ↓
multiSourceRetriever.ts ── 从多个来源检索相关上下文
    ↓
relevanceScoring.ts ──── 相关性评分和排序（295 行）
    ↓
contextBuilder.ts ──── 构建检索上下文字符串（注入 AI 提示）
    ↓
conversationSummarizer.ts ── Phase 3: 长对话摘要（341 行）
    ↓
userFeedback.ts ──── Phase 3: 收集用户隐式反馈（326 行）
    ↓
performanceMonitor.ts ── 记录 RAG 性能指标
```

✅ **集成方式**（在 `useChatAI.ts`）
```typescript
const ragResult = await executeRAG(userMessage, chatHistory, options);
// ragResult.context 作为额外上下文注入系统提示
```

---

### 3.6 情绪检测系统

**双通道融合**:

| 通道 | 文件 | 方式 |
|------|------|------|
| 面部 | `faceDetection/useFaceDetection.ts` | MLKit worklet |
| 文本 | `capabilities/emotion/emotionAnalysis.ts` | 关键词 + Claude |
| 融合 | `utils/emotionDetection.ts` | 文本优先 > 面部 > neutral |

✅ **Plutchik 8 种基础情绪**（新版本升级自 5 种）:
joy, sadness, anger, fear, surprise, disgust, trust, anticipation

✅ **UI 组件**:
- `components/vision/EmotionDetector.tsx` — 可拖拽浮动检测窗口
- `components/vision/DraggableCameraView.tsx`

---

### 3.7 主动对话系统

**文件**: `hooks/ai/useProactiveConversation.ts`（224 行）

✅ **3 阶段沉默检测**:
- Short pause → 轻柔的话题引出（可使用记忆话题种子）
- Medium pause → 基于对话上下文的跟进问题
- Long pause → 深度互动尝试

✅ **话题种子集成**:
```typescript
const topicSeeds = useTopicSeeds();
// messages.length === 0 时优先使用记忆话题
const memoryHook = messages.length === 0 ? topicSeeds[0]?.hook : undefined;
const topic = memoryHook ?? selectProactiveTopic('short', messages);
```

---

### 3.8 Live2D 动作系统

**文件**: `capabilities/motion/motionMapper.ts`（398 行）

✅ **上下文感知动作选择**（新升级）:

```typescript
interface ConversationContext {
  text?: string;          // 消息文本
  emotion?: EmotionType;  // 检测情绪
  isGreeting?: boolean;   // 是否问候
  isQuestion?: boolean;   // 是否提问
  isEncouragement?: boolean;
  isCelebration?: boolean;
  isEmpathy?: boolean;
  aiSpeaking?: boolean;
  aiThinking?: boolean;
}
```

✅ **Plutchik 情绪 → 动作映射**:

| 情绪 | 动作 |
|------|------|
| joy | Happy |
| sadness | Sleepy |
| anger | Surprised |
| fear | Shy |
| surprise | Surprised |
| disgust | Thinking |
| trust | Happy |
| anticipation | Excited |

✅ **动作优先级系统**:
IDLE(0) < EMOTION(1) < CONTEXT(2) < AI_STATUS(3) < SPECIAL(4)

✅ **11 种动作**:
Idle, Happy, Surprised, Shy, Wave, Dance, Laugh, Thinking, Speaking, Excited, Sleepy

---

### 3.9 人格与个性化系统

**文件**: `src/constants/personality.ts`（271 行）

✅ **兰兰（LanLan）完整人设**:
- 名字: 兰兰（17 岁日本女高中生风格）
- 灵感: 毛利兰（《名侦探柯南》）
- 说话特点: 短句、温柔、偶尔害羞
- 惯用表达: "诶？"、"嗯…"、"欸嘿嘿"

✅ **记忆连续性指令**（Task 5 新增）:
```
# Conversation continuity
If the user sends a simple greeting, naturally bring up ONE thing you remember —
a recent worry, upcoming event, or something they mentioned.
Do this only when it feels natural. One reference per opening.
```

---

## Character - 网页应用

- **框架**: Remix 2.16.8 + PIXI.js 7.4.3 + pixi-live2d-display-mulmotion
- **开发端口**: 5174
- **功能**: Hiyori Live2D 模型渲染 + JavaScript Bridge（供 WebView 调用）
- **Bridge API**: `playMotion`, `getAvailableMotions`, `isModelLoaded`, `getReadinessState`
- **心跳**: 每 5 秒发送状态更新
- **初始化**: 5 阶段（domReady → live2dReady → modelReady → bridgeReady → allReady）

---

## 技术栈

### EmoMate

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Expo | 54 |
| RN | React Native | 0.81.5 |
| UI | React | 19.1.0 |
| 类型 | TypeScript | 5.9.2 |
| AI | Claude API | claude-haiku-4-5 / claude-sonnet-4-6 |
| TTS | ElevenLabs | REST API |
| STT | expo-speech-recognition | ^2.1.1 |
| 视觉 | react-native-vision-camera | ^4.7.2 |
| 面部 | vision-camera-face-detector | ^1.9.0 |
| 存储 | react-native-mmkv | ^4.0.0 |
| 数据库 | expo-sqlite | ~16.0.10 |
| 状态 | zustand + immer | 5.0.6 |
| 动画 | react-native-reanimated | ~4.1.1 |
| 导航 | @react-navigation | ^7 |
| 样式 | nativewind | ^4.1.23 |

---

## 状态管理体系

9 个 Zustand store（均从 `src/store/index.ts` barrel export）:

| Store | 存储后端 | 功能 |
|-------|----------|------|
| `userStore` | 内存 | 用户状态、AI 角色选择 |
| `chatStore` | MMKV | 持久化对话历史 |
| `emotionStore` | 内存 | 当前情绪状态（面部 + 文本） |
| `sceneStore` | 内存 | 当前场景数据 |
| `objectRecognitionStore` | 内存 | 物体识别结果 |
| `backgroundStore` | 内存 | 动态背景状态 |
| `monitorStore` | 内存 | 函数监控调试数据 |
| `memoryStore` | MMKV | UserProfile + UserPreferences |
| `memoryDatabase` | SQLite | episodes + facts 操作函数 |

---

## 已知技术债务与待优化项

### 高优先级

| 项目 | 说明 |
|------|------|
| 测试框架 | 无测试覆盖（Jest + React Native Testing Library） |
| 情绪类型扩展 | 现有 8 种（Plutchik），可扩展到更细粒度 |
| 记忆话题种子 | medium/long pause 目前未使用 seeds[1]/seeds[2]（预留 v2） |
| Live2D 口型同步 | LipSync 尚未实现 |

### 中优先级

| 项目 | 说明 |
|------|------|
| 离线语音识别 | 当前需要网络 |
| 内存管理 | 长时间聊天的 messages 数组无上限 |
| Android 完整测试 | 主要在 iOS 测试 |
| CI/CD | 无自动化构建 |

### 低优先级

| 项目 | 说明 |
|------|------|
| 云同步记忆 | 记忆目前仅本地 |
| API 文档 | 无 OpenAPI 规范 |
| 架构图 | 无 Mermaid 图示 |
| 多语言扩展 | 日语支持计划中 |

---

## 开发指南

### 启动开发环境

**EmoMate（移动应用）**:
```bash
cd EmoMate
npm install
npm start              # 生产模式
SHOW_TEST_COMPONENTS=true npm start  # 调试模式
```

**Character（Web 应用）**:
```bash
cd character
npm install
npm run dev           # http://192.168.31.28:5174/
```

### TypeScript 全量检查
```bash
cd EmoMate
npx tsc --noEmit
# 期望: 0 errors
```

### 常见开发任务

**添加新能力模块**:
```
1. 在 src/capabilities/<capability>/ 创建目录
2. 实现功能文件
3. 创建 index.ts barrel export
4. 在 src/capabilities/index.ts 中 re-export
```

**添加新 Zustand store**:
```
1. 创建 src/store/<name>Store.ts
2. 在 src/store/index.ts 添加 export
```

**添加新 Hiyori 动作**:
```
1. character/ 项目确保模型文件有对应动作
2. src/store/useAIStatus.ts 更新 HiyoriMotion 类型
3. src/capabilities/motion/motionMapper.ts 添加映射规则
```

---

## 项目健康度（2026-02-19）

| 指标 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | 92% | 核心功能全部完成，口型同步等高级特性待做 |
| 代码质量 | 85% | TypeScript strict + capabilities 架构，需补测试 |
| 文档完善度 | 88% | 29 份文档，缺少 API 规范和架构图 |
| 性能表现 | 80% | TTS 并行合成 + 音频缓存，有进一步优化空间 |
| 生产就绪度 | 90% | 核心链路稳定可靠，建议补充监控后上线 |

---

**报告完成于**: 2026-02-19
**代码库**: `refactor` 分支
**项目状态**: 🚀 生产就绪（92%）

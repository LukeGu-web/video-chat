# AI 系统

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 一、AI 能力感知系统

AI（兰兰）需要知道自己具备哪些能力，才能在对话中自然地提及"我看到你…"、"我能看见你周围的环境"等。本系统通过在系统提示中声明能力，让 AI 完全了解自身的视觉、情绪检测、动作表达等功能。

### 已声明的 10 项能力

| 能力 ID | 名称 | 技术支撑 |
|---------|------|---------|
| `text_conversation` | 文字对话 | Claude API |
| `voice_synthesis` | 语音合成 | ElevenLabs |
| `voice_recognition` | 语音识别 | Device STT |
| `emotional_support` | 情感支持 | Claude |
| `facial_recognition` | 面部识别 | MLKit |
| `emotion_detection` | 情绪检测 | MLKit + Claude |
| `visual_perception` | 视觉感知 | Camera + MLKit |
| `scene_understanding` | 场景理解 | Claude Vision API |
| `character_animation` | 角色动作表达 | Live2D（11 种动作）|
| `multimodal_understanding` | 多模态理解 | Claude + MLKit 融合 |

### 系统提示注入

`generateCapabilityPrompt()` 在系统提示中添加两段说明：

**视觉能力说明**：

- 通过摄像头和面部识别实时观察用户表情
- 能感知 5 种情绪（开心/悲伤/惊讶/生气/中性）
- 通过场景理解识别用户所处环境及物品
- 被问"你能看见我吗"时应自信回答"可以"
- 可主动提及观察到的情绪变化和环境细节

**动作能力说明**：

- 拥有 Hiyori Live2D 角色形象，11 种动作
- 情绪变化时自动触发对应动作
- 让交流更生动而不只是文字

### 能力查询接口

`src/constants/ai.ts` 导出三个工具函数：

- `getAICapabilities()` — 返回所有 10 项能力列表
- `hasCapability(id)` — 检查特定能力是否可用
- `getCapabilityStatus()` — 返回状态对象（`canSeeUser`、`canDetectEmotion`、`canUnderstandScene` 等）

### 相关文件

| 文件 | 职责 |
|------|------|
| `constants/ai.ts` | 能力声明、提示词生成、状态查询 |
| `hooks/useChatAI.ts` | 将能力提示词注入系统消息 |
| `hooks/ai/buildAIContext.ts` | 组装完整系统提示（含能力块）|

---

## 二、AI 对话优化

解决两个关键对话质量问题：（1）最后一句话说不完整；（2）单独语气词导致情绪识别失败和无意义 TTS 音频。

### 优化 1：句子检测（sentenceDetector.ts）

**问题**：流式 API 最后的文本片段可能没有标点，TTS 合成效果差甚至中途截断。

**方案**：

- `flush()` 方法在句子末尾自动补充标点。检测到疑问词（"吗/呢/怎么/为什么"）补"？"，感叹词（"太/好棒/真"）补"！"，其他默认补"。"

- `isStandaloneInterjection()` 方法识别纯语气词（≤3 字符的"嗯/呃/啊/哦/诶/欸"等）。纯语气词不作为独立句子输出，等待与后续内容合并（"嗯…" + "让我想想" → "嗯…让我想想。"）

**效果**：最后一句不完整率从 ~8% 降至 ~0%；单独语气词 TTS 从 ~15% 降至 ~2%。

### 优化 2：AI 提示词规范

**问题**：人格提示词鼓励使用语气词，但没有要求语气词必须与内容组合。

**方案**：在系统提示中添加语气词使用规范，禁止单独回复"嗯…"、"欸？"等纯语气词，要求语气词后必须跟实际内容。

**效果**：从源头减少问题产生，提升 Live2D 动作联动准确性。

### 优化 3：情绪分析过滤

**问题**：纯语气词的情绪分析不准确，且浪费 API 调用。

**方案**：

- 纯语气词（≤3 字符匹配 `PURE_INTERJECTIONS` 列表）直接返回 `neutral`，跳过 API 调用
- 文本 < 4 字符也跳过 API，默认返回 `neutral`
- 关键词库扩展：新增"太好了/好棒"→happy，"欸？/真的吗"→surprised

**效果**：情绪识别 API 调用率从 ~40% 降至 ~15%；动作联动准确率从 ~75% 提升至 ~95%。

### 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/speak/sentenceDetector.ts` | 句子分割、语气词过滤、末尾标点补全 |
| `capabilities/emotion/emotionAnalysis.ts` | 情绪关键词匹配 + Claude 语义分析 |
| `constants/ai.ts` | 语气词使用规范（系统提示词）|

---

## 三、Prompt Caching

通过 Claude Prompt Caching API（`anthropic-beta: prompt-caching-2024-07-31`），EmoMate 将稳定的系统提示块标记为可缓存，显著降低 API 成本和响应延迟。

### 三级缓存策略

| 缓存块 | 内容 | 约 Token | 是否缓存 |
|--------|------|---------|---------|
| Block 1 | 核心人格设定 | ~1000 | ✅ 缓存 |
| Block 2 | 能力说明 | ~200 | ✅ 缓存 |
| Block 3 | 对话历史（前 5 条） | ~100 | ✅ 缓存 |
| 动态 | 情绪响应、场景上下文、最新消息 | 可变 | ❌ 不缓存 |

缓存断点通过 `cache_control: { type: 'ephemeral' }` 标记，共 3 个（不超过 API 最大 4 个限制）。

### 效果

| 指标 | 无缓存 | 有缓存 | 改善 |
|------|--------|--------|------|
| 首字节响应时间 | ~2000ms | ~300ms | ↓ 85% |
| 100 次请求成本 | $0.459 | $0.113 | ↓ 75% |

缓存 TTL 为 5 分钟，缓存失效条件：内容变化（包括空格）、切换模型、超时。

### 缓存监控

`src/utils/cacheMetrics.ts` 提供完整的缓存指标追踪：命中率、节省 token 数、节省成本（USD）。在 `useChatAI.ts` 中通过 `getCacheStats()` 可读取当前统计数据。

### 相关文件

| 文件 | 职责 |
|------|------|
| `hooks/ai/buildAIContext.ts` | `buildCacheableSystemPrompt()`、`buildCacheableMessages()` |
| `hooks/useChatAI.ts` | 添加 `anthropic-beta` 请求头，集成缓存追踪 |
| `utils/cacheMetrics.ts` | 缓存命中率、成本节省统计 |

# EmoMate 文档索引

**最后更新**: 2026-02-19

---

## AI 系统

| 文档 | 内容 |
|------|------|
| [AI_CAPABILITY_INTEGRATION.md](./AI_CAPABILITY_INTEGRATION.md) | AI 能力声明与系统提示注入（10 项能力）|
| [AI_DIALOGUE_OPTIMIZATION.md](./AI_DIALOGUE_OPTIMIZATION.md) | 句子完整性、语气词过滤、情绪分析优化 |
| [PROMPT_CACHING_IMPLEMENTATION_SUMMARY.md](./PROMPT_CACHING_IMPLEMENTATION_SUMMARY.md) | Prompt Caching（节省 75% 成本，降低 73% 延迟）|

---

## 记忆系统

| 文档 | 内容 |
|------|------|
| [MEMORY_SYSTEM_DESIGN.md](./MEMORY_SYSTEM_DESIGN.md) | 四层记忆架构（UserProfile / Preferences / Episodes / Facts）|
| [RAG_SYSTEM_DESIGN.md](./RAG_SYSTEM_DESIGN.md) | 检索增强生成（历史对话检索注入上下文）|

---

## 情绪与视觉

| 文档 | 内容 |
|------|------|
| [EMOTION_DETECTION_ARCHITECTURE.md](./EMOTION_DETECTION_ARCHITECTURE.md) | 双通道情绪检测（MLKit 面部 + 文本分析）|
| [FACE_DETECTION_COMPLETE_GUIDE.md](./FACE_DETECTION_COMPLETE_GUIDE.md) | 面部检测实现指南（Development Build 要求、关键决策、常见问题）|
| [VISUAL_CAPABILITY.md](./VISUAL_CAPABILITY.md) | 场景理解系统（Claude Vision API，三种触发机制）|

---

## 语音合成（TTS）

| 文档 | 内容 |
|------|------|
| [TTS_FEATURES.md](./TTS_FEATURES.md) | TTSQueue 并行合成 + 顺序播放架构，ElevenLabs 情绪参数 |

---

## Live2D 角色

| 文档 | 内容 |
|------|------|
| [HIYORI_INTEGRATION.md](./HIYORI_INTEGRATION.md) | Hiyori WebView 集成，Bridge 协议，11 种动作 |
| [HIYORI_MOTION_OPTIMIZATION.md](./HIYORI_MOTION_OPTIMIZATION.md) | 上下文感知动作选择，优先级系统，情绪组合映射 |
| [MOTION_LOOP_FEATURE.md](./MOTION_LOOP_FEATURE.md) | Speaking/Thinking 动作循环播放实现 |

---

## 其他功能

| 文档 | 内容 |
|------|------|
| [BILINGUAL_SUPPORT.md](./BILINGUAL_SUPPORT.md) | 中英文自动检测与切换 |
| [BACKGROUND_SCENES_GUIDE.md](./BACKGROUND_SCENES_GUIDE.md) | 背景场景配置系统（时间/天气/优先级）|
| [SMART_CONTENT_PRIORITIZATION_SUMMARY.md](./SMART_CONTENT_PRIORITIZATION_SUMMARY.md) | SmartSentenceBuffer（已禁用，仅存档）|

---

## 快速导航

- 了解项目整体状态 → 查阅根目录 `PROJECT_EXPLORATION_REPORT.md`
- 了解各系统集成方式 → 查阅根目录 `CLAUDE.md`
- 了解特定功能实现 → 查阅本目录对应文档

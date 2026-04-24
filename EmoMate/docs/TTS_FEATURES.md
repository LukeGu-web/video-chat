# TTS 语音合成系统

**状态**: ✅ 生产就绪
**架构版本**: v2.0（TTSQueue + 并行合成）

---

## 概述

EmoMate 的 TTS 系统实现了**并行合成 + 顺序播放**的流水线：AI 流式输出文本时，系统实时切割句子并立即发起合成，句子合成完成后按顺序依次播放，做到"说话不等待"的体验。

---

## 核心架构

文件位于 `src/capabilities/speak/`，分为四层：

**类型层**（`src/types/speak/`）：集中管理所有 TTS 相关的 TypeScript 类型，包含通用类型、Provider 接口、缓存接口、队列接口。

**Provider 层**：两个实现：

- `ElevenLabsProvider` — 主用，高质量网络 TTS
- `ExpoSpeechProvider` — 后备，设备本地 TTS

**缓存层**（`AudioCache`）：将合成结果缓存为本地音频文件，相同文本无需重复合成。

**队列层**（`TTSQueue`）：核心组件，管理并发合成和顺序播放。

---

## TTSQueue 工作原理

流程：AI 流式响应 → `sentenceDetector` 实时切句 → `TTSQueue.enqueue()` 入队 → 最多 2 个并发合成任务 → 音频文件就绪后顺序播放。

关键参数：

- 最多 2 个并发合成（避免触发 ElevenLabs rate limit）
- 失败自动重试，最多 3 次，间隔 1 秒
- 支持 `cancel()`（用户打断时立即停止）
- 支持 `waitForCompletion()`（等待当前语音播放完毕）

---

## ElevenLabs 配置

**语音 ID**：`hkfHEbBvdQFNX4uWHqRF`（专为兰兰优化）

**情绪感知参数**：根据检测到的用户情绪动态调整语音风格：

| 情绪 | stability | similarity_boost | style |
|------|-----------|-----------------|-------|
| gentle（默认） | 0.4 | 0.7 | 0.25 |
| happy | 0.3 | 0.65 | 0.4 |
| caring | 0.6 | 0.8 | 0.2 |
| shy | 0.45 | 0.75 | 0.35 |

---

## App 启动预热

`App.tsx` 在启动时执行 TTS 预热：向 ElevenLabs 发送一个极短的测试请求（"嗯"），预建立 HTTPS 连接并验证 API key，避免第一句话出现明显延迟。预热失败不影响 App 正常启动。

同时在启动时调用 `initializeTTSCache()` 确保本地缓存目录存在。

---

## 音频会话配置

启动时通过 `expo-audio` 的 `setAudioModeAsync` 配置：

- `playsInSilentMode: true` — 静音模式下仍可播放
- `allowsRecording: false` — 初始关闭录音以确保扬声器输出
- `shouldPlayInBackground: true` — 后台可继续播放
- `interruptionMode: 'duckOthers'` — 播放时压低其他音频
- `shouldRouteThroughEarpiece: false` — Android 使用扬声器而非听筒

---

## SmartSentenceBuffer（已禁用）

`smartSentenceBuffer.ts` 实现了基于内容评分的智能句子过滤（三层防御：System Prompt 排序 → 实时过滤 → 最终验证），但因为会导致句子不完整而已被禁用。目前的内容完整性依靠人格提示词直接指导 AI 排序输出。

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/speak/queue/TTSQueue.ts` | 队列管理核心 |
| `capabilities/speak/providers/ElevenLabsProvider.ts` | ElevenLabs 合成 |
| `capabilities/speak/providers/ExpoSpeechProvider.ts` | 本地 TTS 后备 |
| `capabilities/speak/cache/AudioCache.ts` | 音频文件缓存 |
| `capabilities/speak/elevenLabsAPI.ts` | API 封装 |
| `capabilities/speak/sentenceDetector.ts` | SSE 流切句 |
| `constants/speak.ts` | 语音相关常量 |

# AI 能力感知系统

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 概述

AI（兰兰）需要知道自己具备哪些能力，才能在对话中自然地提及"我看到你…"、"我能看见你周围的环境"等。本系统通过在系统提示中声明能力，让 AI 完全了解自身的视觉、情绪检测、动作表达等功能。

---

## 已声明的 10 项能力

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

---

## 系统提示注入

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

---

## 能力查询接口

`src/constants/ai.ts` 导出三个工具函数：

- `getAICapabilities()` — 返回所有 10 项能力列表
- `hasCapability(id)` — 检查特定能力是否可用
- `getCapabilityStatus()` — 返回状态对象（`canSeeUser`、`canDetectEmotion`、`canUnderstandScene` 等）

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `constants/ai.ts` | 能力声明、提示词生成、状态查询 |
| `hooks/useChatAI.ts` | 将能力提示词注入系统消息 |
| `hooks/ai/buildAIContext.ts` | 组装完整系统提示（含能力块）|

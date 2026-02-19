# 情绪检测架构

**状态**: ✅ 生产就绪（MLKit 真实检测）
**架构版本**: v2.0（Capabilities-based）

---

## 系统架构

情绪检测系统采用双通道设计：**面部情绪**来自 MLKit 实时检测摄像头帧，**文本情绪**来自关键词匹配或 Claude 语义分析。两路结果在 `emotionStore` 中融合，文本情绪优先。

```
相机帧 ──→ useFaceDetection（Reanimated worklet）──→ emotionAlgorithm ──→ emotionStore
                                                                               ↑
用户消息 ──→ 关键词匹配 → Claude API（语义分析备用）──────────────────────────────┘
```

最终融合结果：文本情绪 > 面部情绪 > neutral。

---

## 面部情绪检测（capabilities/vision/faceDetection/）

### 模块组成

- `useFaceDetection.ts` — 主 hook，集成 react-native-vision-camera + MLKit
- `emotionAlgorithm.ts` — 从 MLKit 概率值推断情绪类型
- `faceFeatures.ts` — 提取面部特征（smilingProbability, eyeOpenProbability）
- `worklets.ts` — Reanimated worklet，在独立线程处理帧以保持 60fps

### MLKit 检测配置

- 库：`react-native-vision-camera-face-detector` v1.9.0
- 性能模式：fast
- 分类模式：all（启用情绪概率分类）
- 最小面部尺寸：0.15

### 情绪推断算法

| 条件 | 情绪 |
|------|------|
| smilingProbability > 0.6 | joy |
| eyeOpen > 0.8 && smile < 0.3 | surprise |
| eyeOpen < 0.4 && smile < 0.2 | sadness |
| smile < 0.1 && eyeOpen > 0.5 | anger |
| 其他 | neutral |

### UI 组件

- `components/vision/EmotionDetector.tsx` — 可拖拽浮动检测窗口
- `components/vision/DraggableCameraView.tsx` — 可拖拽相机视图基础组件

---

## 文本情绪分析（capabilities/emotion/）

### 双层分析

**层 1 — 关键词匹配**（快速，适合明确词汇）：
- 维护分情绪的中文关键词词典
- 匹配"开心/难过/生气/惊讶"等高频情绪词

**层 2 — Claude 语义分析**（深度，适合复杂表达）：
- 关键词匹配失败时调用 Claude API
- 理解"感觉还好，就是有点累"这类隐性情绪

### 状态管理

`emotionStore`（Zustand）集中管理：
- `facialEmotion` — 来自 MLKit
- `textEmotion` — 来自文本分析
- `combinedEmotion` — 融合结果（文本优先）

`emotionStore` 由 HomeScreen 通过 `setFacialEmotion` 更新，文本情绪分析在 `useChatAI.ts` 中触发。

---

## 情绪类型

当前使用 Plutchik 8 种基础情绪（`src/types/emotion.ts`）：

`joy | sadness | anger | fear | surprise | disgust | trust | anticipation`

MLKit 面部检测目前能区分其中 4 种（joy/sadness/anger/surprise），其余情绪主要来自文本分析。

---

## 情绪 → Live2D 动作映射

情绪检测结果最终驱动 Hiyori 的动作。映射逻辑在 `capabilities/motion/motionMapper.ts`，详见 [HIYORI_MOTION_OPTIMIZATION.md](./HIYORI_MOTION_OPTIMIZATION.md)。

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/vision/faceDetection/` | MLKit 面部检测模块 |
| `capabilities/emotion/emotionAnalysis.ts` | 文本情绪分析 |
| `capabilities/emotion/useEmotionState.ts` | 情绪状态 hook |
| `store/emotionStore.ts` | 全局情绪状态 |
| `utils/emotionDetection.ts` | 情绪融合工具函数 |
| `types/emotion.ts` | 情绪类型定义 |
| `components/vision/EmotionDetector.tsx` | 检测 UI 组件 |

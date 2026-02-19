# 情绪与视觉系统

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 一、情绪检测架构

情绪检测系统采用双通道设计：**面部情绪**来自 MLKit 实时检测摄像头帧，**文本情绪**来自关键词匹配或 Claude 语义分析。两路结果在 `emotionStore` 中融合，最终优先级为：文本情绪 > 面部情绪 > neutral。

### 面部情绪检测（capabilities/vision/faceDetection/）

MLKit 通过 react-native-vision-camera 在 Reanimated worklet 独立线程中处理相机帧，保持 60fps 不阻塞主线程。

**检测配置**：性能模式 fast、分类模式 all（启用情绪概率）、最小面部尺寸 0.15。

**情绪推断算法**：

| 条件 | 情绪 |
|------|------|
| smilingProbability > 0.6 | joy |
| eyeOpen > 0.8 && smile < 0.3 | surprise |
| eyeOpen < 0.4 && smile < 0.2 | sadness |
| smile < 0.1 && eyeOpen > 0.5 | anger |
| 其他 | neutral |

**UI 组件**：`EmotionDetector.tsx` 为可拖拽浮动检测窗口，`DraggableCameraView.tsx` 为基础拖拽相机视图。

### 文本情绪分析（capabilities/emotion/）

双层分析策略：

- **层 1 — 关键词匹配**（快速）：维护分情绪的中文关键词词典，匹配"开心/难过/生气/惊讶"等高频情绪词。
- **层 2 — Claude 语义分析**（深度）：关键词匹配失败时调用 Claude API，理解"感觉还好，就是有点累"这类隐性情绪。

### 情绪类型

当前使用 Plutchik 8 种基础情绪（`src/types/emotion.ts`）：`joy | sadness | anger | fear | surprise | disgust | trust | anticipation`。

MLKit 面部检测目前能区分其中 4 种（joy/sadness/anger/surprise），其余主要来自文本分析。

### 情绪 → Live2D 动作映射

情绪检测结果最终驱动 Hiyori 的动作。映射逻辑在 `capabilities/motion/motionMapper.ts`，详见本文档第三节（视觉能力）之后的 `LIVE2D.md`。

### 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/vision/faceDetection/` | MLKit 面部检测模块 |
| `capabilities/emotion/emotionAnalysis.ts` | 文本情绪分析 |
| `capabilities/emotion/useEmotionState.ts` | 情绪状态 hook |
| `store/emotionStore.ts` | 全局情绪状态（facialEmotion / textEmotion / combinedEmotion）|
| `utils/emotionDetection.ts` | 情绪融合工具函数 |
| `types/emotion.ts` | 情绪类型定义 |
| `components/vision/EmotionDetector.tsx` | 检测 UI 组件 |

---

## 二、面部检测集成指南

### 重要：必须使用 Development Build

面部检测使用自定义原生模块（MLKit），**无法在 Expo Go 中运行**。必须构建 Development Build：

- **云端构建（推荐）**：`eas build --profile development --platform ios`
- **本地构建**：`npx expo prebuild && npx expo run:ios`

构建完成后使用 `npx expo start --clear --dev-client` 启动，在 Development Build 应用中扫码。

### 关键依赖

| 库 | 版本 | 用途 |
|----|------|------|
| react-native-vision-camera | ^4.7.2 | 高性能相机 |
| react-native-vision-camera-face-detector | 1.9.0 | MLKit 面部检测 |
| react-native-worklets-core | ^1.6.2 | Reanimated worklet 通信 |

Babel 配置中插件顺序必须正确：`worklets-core/plugin` 在前，`reanimated/plugin` 在后（最后）。

### 实现关键点

1. **不使用包装的 Camera 组件**：直接使用 `react-native-vision-camera` 的 `Camera`，加上 `useFaceDetector` hook 获取 `detectFaces` 函数，手动在 `useFrameProcessor` 中调用。

2. **Worklet 通信**：Frame Processor 运行在独立 JS 线程，不能直接调用 React 状态更新。必须用 `Worklets.createRunOnJS(callback)` 将回调转换为 worklet 兼容函数再调用。

3. **检测间隔节流**：每帧调用检测开销较大，用 `lastDetection.current` 记录时间戳，只在达到配置间隔（默认 3 秒）且置信度 > 0.6 时才更新情绪状态。

### 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| performanceMode | fast | 快速模式（推荐）|
| classificationMode | all | 启用情绪概率分类 |
| minFaceSize | 0.15 | 最小人脸占画面比例 |
| trackingEnabled | false | 不启用追踪（节省资源）|
| detectionInterval | 3000ms | 情绪更新最小间隔 |

性能问题时可调高 `minFaceSize`（0.2–0.3）或 `detectionInterval`（5000ms）。

### 常见问题

**"Requiring unknown module 1338"**：未在 Development Build 中运行，或 Metro 没有使用 `--dev-client` 参数。

**Frame Processor 错误 "cannot be shared"**：JS 函数没有通过 `Worklets.createRunOnJS` 包装就在 worklet 中调用了。

**检测不到情绪**：光线不足、人脸偏小（尝试降低 `minFaceSize`）、或人脸角度过大（需正面朝向摄像头）。

**性能掉帧**：改用 `performanceMode: 'fast'`，增大检测间隔，增大 `minFaceSize`。

### 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/vision/faceDetection/useFaceDetection.ts` | 主 hook，集成 VisionCamera + MLKit |
| `capabilities/vision/faceDetection/emotionAlgorithm.ts` | 从 MLKit 概率值推断情绪 |
| `capabilities/vision/faceDetection/faceFeatures.ts` | 提取面部特征 |
| `capabilities/vision/faceDetection/worklets.ts` | Reanimated worklet 实现 |
| `components/vision/EmotionDetector.tsx` | 可拖拽浮动检测窗口 |

---

## 三、视觉能力 — 场景理解系统

EmoMate 的视觉能力让 AI（兰兰）能够通过摄像头感知用户所处环境。通过 Claude Vision API 分析相机帧，识别场景位置、物品、氛围、光线等信息，并将这些信息自然地融入对话。

### 核心功能

- **场景识别**：识别位置（咖啡馆、办公室、卧室等）
- **物品检测**：发现书籍、电脑、咖啡杯等物品，支持书名/品牌识别
- **氛围感知**：判断场景氛围（安静学习、工作专注、休闲放松等）
- **视觉问答**：用户提问"这是什么"时，立即触发分析
- **场景记忆**：缓存近期场景，避免重复调用

### 触发机制

| 触发方式 | 时机 | 说明 |
|---------|------|------|
| 对话关键词 | 用户消息匹配视觉词汇时 | 立即触发，绕过冷却时间 |
| 场景变化 | 每 30 秒拍照，相似度 < 70% | 1 分钟冷却防止误触发 |
| 定时触发 | 每 5 分钟 | 保持场景信息新鲜度 |

视觉关键词示例："这是什么"、"看看"、"识别"、"周围有什么"、"这本书"等（共 12 个关键词）。

### 场景缓存

缓存存储于 MMKV，最多保存 3 个场景，每个场景有效期 30 分钟。新场景拍摄后先与缓存对比：相似度 > 95% 则复用缓存（典型节省 60–80% API 调用），否则调用 Claude Vision 重新分析。

### AI 对话集成

场景数据在 `useChatAI.ts` 中构建为自然语言描述，注入系统提示。AI 可以主动提及观察到的环境细节、回答视觉问题、感知环境变化。

### 成本控制

- 模型：Claude 3.5 Sonnet（`claude-sonnet-4-5-20250929`）
- 单次分析成本：$0.004 – $0.01
- 通过智能去重和 5 分钟定时间隔，每日成本通常在 $0.02–0.20
- App 进入后台时暂停检测，对话不活跃时自动暂停

### 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/vision/environment/useSceneUnderstanding.ts` | 场景检测、触发管理、缓存控制 |
| `capabilities/vision/claudeVision.ts` | Claude Vision API 封装 |
| `capabilities/vision/environment/buildScenePrompt.ts` | 将场景数据转换为自然语言提示 |
| `capabilities/vision/environment/sceneKeywords.ts` | 视觉关键词检测（中英文双语）|
| `capabilities/vision/environment/imageComparison.ts` | 图像相似度对比 |
| `types/scene.ts` | 场景数据类型定义 |

# 面部检测完整指南

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 概述

EmoMate 使用 MLKit 进行实时面部情绪检测，通过 react-native-vision-camera-face-detector（v1.9.0）集成，在 Reanimated worklet 中以 60fps 处理相机帧。详细架构参见 [EMOTION_DETECTION_ARCHITECTURE.md](./EMOTION_DETECTION_ARCHITECTURE.md)。

---

## 重要：必须使用 Development Build

面部检测使用自定义原生模块（MLKit），**无法在 Expo Go 中运行**。必须构建 Development Build：

- **云端构建（推荐）**：`eas build --profile development --platform ios`
- **本地构建**：`npx expo prebuild && npx expo run:ios`

构建完成后使用 `npx expo start --clear --dev-client` 启动，在 Development Build 应用中扫码。

---

## 关键依赖

| 库 | 版本 | 用途 |
|----|------|------|
| react-native-vision-camera | ^4.7.2 | 高性能相机 |
| react-native-vision-camera-face-detector | 1.9.0 | MLKit 面部检测 |
| react-native-worklets-core | ^1.6.2 | Reanimated worklet 通信 |

Babel 配置中插件顺序必须正确：`worklets-core/plugin` 在前，`reanimated/plugin` 在后（最后）。

---

## 实现关键点

面部检测的实现有几个关键决策，避免走弯路：

1. **不使用包装的 Camera 组件**：直接使用 `react-native-vision-camera` 的 `Camera`，加上 `useFaceDetector` hook 获取 `detectFaces` 函数，手动在 `useFrameProcessor` 中调用。

2. **Worklet 通信**：Frame Processor 运行在独立 JS 线程，不能直接调用 React 状态更新。必须用 `Worklets.createRunOnJS(callback)` 将回调转换为 worklet 兼容函数再调用。

3. **检测间隔节流**：每帧调用检测开销较大，用 `lastDetection.current` 记录时间戳，只在达到配置间隔（默认 3 秒）且置信度 > 0.6 时才更新情绪状态。

---

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| performanceMode | fast | 快速模式（推荐）|
| classificationMode | all | 启用情绪概率分类 |
| minFaceSize | 0.15 | 最小人脸占画面比例 |
| trackingEnabled | false | 不启用追踪（节省资源）|
| detectionInterval | 3000ms | 情绪更新最小间隔 |

性能问题时可调高 `minFaceSize`（0.2–0.3）或 `detectionInterval`（5000ms）。

---

## 常见问题

**"Requiring unknown module 1338"**：未在 Development Build 中运行，或 Metro 没有使用 `--dev-client` 参数。

**Frame Processor 错误 "cannot be shared"**：JS 函数没有通过 `Worklets.createRunOnJS` 包装就在 worklet 中调用了。

**检测不到情绪**：光线不足、人脸偏小（尝试降低 `minFaceSize`）、或人脸角度过大（需正面朝向摄像头）。

**性能掉帧**：改用 `performanceMode: 'accurate'` → `'fast'`，增大检测间隔，增大 `minFaceSize`。

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/vision/faceDetection/useFaceDetection.ts` | 主 hook，集成 VisionCamera + MLKit |
| `capabilities/vision/faceDetection/emotionAlgorithm.ts` | 从 MLKit 概率值推断情绪 |
| `capabilities/vision/faceDetection/faceFeatures.ts` | 提取面部特征 |
| `capabilities/vision/faceDetection/worklets.ts` | Reanimated worklet 实现 |
| `components/vision/EmotionDetector.tsx` | 可拖拽浮动检测窗口 |

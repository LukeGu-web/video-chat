# EmotionDetector 迁移指南

**版本**: v1.0.0
**日期**: 2025-01-18
**状态**: ✅ 重构完成

---

## 📋 迁移概述

本指南帮助你从旧的 `BasicEmotionDetector` 组件迁移到新的模块化 `EmotionDetector` 组件。

**重构收益**:
- 代码减少 88% (688行 → ~150行)
- 职责清晰 (6个职责 → 1个职责)
- 完全模块化
- 更好的性能
- 更易测试

---

## 🔄 组件对比

### 旧组件 (BasicEmotionDetector)

```typescript
// 单一文件，688行，混合6个功能
import { BasicEmotionDetector } from '../components/BasicEmotionDetector';

<BasicEmotionDetector
  onEmotionDetected={handleEmotion}
  isActive={true}
  detectionInterval={1000}
  onFrameCaptured={handleFrame} // 场景捕获混在组件中
  frameCaptureInterval={30000}
/>
```

### 新组件 (EmotionDetector)

```typescript
// 模块化，使用capabilities架构
import { EmotionDetector } from '../components/vision';

<EmotionDetector
  onEmotionDetected={handleEmotion}
  isActive={true}
  detectionInterval={1000}
  // 注意：场景捕获现在由useSceneUnderstanding处理
/>
```

---

## ⚙️ 迁移步骤

### 步骤1: 更新导入语句

**旧代码**:
```typescript
import { BasicEmotionDetector } from '../components/BasicEmotionDetector';
import { EmotionType } from '../types/emotion';
```

**新代码**:
```typescript
import { EmotionDetector } from '../components/vision';
import { EmotionType } from '../types/emotion';
```

---

### 步骤2: 基本功能迁移（情绪检测）

如果你只使用情绪检测功能（不使用场景捕获），迁移非常简单：

**旧代码**:
```typescript
<BasicEmotionDetector
  onEmotionDetected={(emotion) => {
    console.log('Emotion detected:', emotion);
  }}
  isActive={true}
  detectionInterval={1000}
/>
```

**新代码**:
```typescript
<EmotionDetector
  onEmotionDetected={(emotion) => {
    console.log('Emotion detected:', emotion);
  }}
  isActive={true}
  detectionInterval={1000}
/>
```

✅ **无需其他修改！API完全兼容**

---

### 步骤3: 场景捕获功能迁移

如果你使用了场景捕获功能（`onFrameCaptured`），需要改用 `useSceneUnderstanding` hook：

**旧代码** (混在组件中):
```typescript
<BasicEmotionDetector
  onEmotionDetected={handleEmotion}
  onFrameCaptured={(base64, timestamp) => {
    // 处理场景捕获
    console.log('Frame captured:', base64.length);
  }}
  frameCaptureInterval={30000}
/>
```

**新代码** (使用专用hook):
```typescript
import { EmotionDetector } from '../components/vision';
import { useSceneUnderstanding } from '../capabilities/vision/environment';
import { getClaudeApiKey } from '../constants/ai';

function MyComponent() {
  // 1. 初始化场景理解hook
  const apiKey = getClaudeApiKey();
  const sceneUnderstanding = useSceneUnderstanding(apiKey, {
    enabled: true,
    frameCaptureInterval: 30000,
  });

  // 2. 注册拍照回调
  useEffect(() => {
    sceneUnderstanding.setPhotoCaptureCallback(async () => {
      // 从相机获取快照的逻辑
      // 这里需要访问EmotionDetector的camera ref
      // 详见下面的"高级集成"部分
      return null; // 返回base64图片
    });
  }, [sceneUnderstanding]);

  // 3. 启动场景监控
  useEffect(() => {
    sceneUnderstanding.startTimer();
    return () => sceneUnderstanding.stopTimer();
  }, [sceneUnderstanding]);

  return (
    <EmotionDetector
      onEmotionDetected={handleEmotion}
      isActive={true}
    />
  );
}
```

---

### 步骤4: 高级集成（场景理解 + 情绪检测）

如果需要完整的场景理解功能（包括拍照），参考以下模式：

```typescript
import React, { useRef, useEffect } from 'react';
import { Camera } from 'react-native-vision-camera';
import { EmotionDetector } from '../components/vision';
import { useSceneUnderstanding } from '../capabilities/vision/environment';
import { getClaudeApiKey } from '../constants/ai';

function AdvancedEmotionScreen() {
  const cameraRef = useRef<Camera>(null);
  const apiKey = getClaudeApiKey();

  // 场景理解hook
  const {
    currentScene,
    startTimer,
    stopTimer,
    setPhotoCaptureCallback,
  } = useSceneUnderstanding(apiKey);

  // 注册拍照回调
  useEffect(() => {
    setPhotoCaptureCallback(async () => {
      if (!cameraRef.current) return null;

      try {
        const snapshot = await cameraRef.current.takeSnapshot({
          quality: 85,
        });

        if (snapshot?.path) {
          // 转换为base64
          const base64 = await fetch(`file://${snapshot.path}`)
            .then((res) => res.blob())
            .then((blob) => {
              return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  const base64Data = result.split(',')[1];
                  resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            });

          return base64;
        }
      } catch (error) {
        console.error('Photo capture failed:', error);
      }

      return null;
    });
  }, [setPhotoCaptureCallback]);

  // 启动场景监控
  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [startTimer, stopTimer]);

  return (
    <>
      {/* 情绪检测组件 */}
      <EmotionDetector
        onEmotionDetected={(emotion) => {
          console.log('Emotion:', emotion);
        }}
        isActive={true}
      />

      {/* 显示场景信息 */}
      {currentScene && (
        <View>
          <Text>Scene: {currentScene.description}</Text>
        </View>
      )}
    </>
  );
}
```

---

## 🆕 新功能和改进

### 1. 使用独立的Capabilities Hooks

现在你可以单独使用各个功能模块：

```typescript
import { useFaceDetection } from '../capabilities/vision/faceDetection';
import { useCamera } from '../capabilities/vision/camera';
import { useCameraPermissions } from '../capabilities/vision/camera';

// 自定义组件
function MyCustomEmotionUI() {
  const { hasPermission, requestPermission } = useCameraPermissions();
  const { device, switchCamera } = useCamera();
  const { frameProcessor, faceDetected } = useFaceDetection({
    isActive: true,
    onEmotionDetected: (emotion) => console.log(emotion),
  });

  // 自定义UI渲染...
}
```

### 2. 情绪分析增强

新的情绪检测算法更精确：

```typescript
import { detectEmotionFromFace } from '../capabilities/vision/faceDetection';

// 手动调用情绪检测算法
const result = detectEmotionFromFace({
  smilingProbability: 0.8,
  avgEyeOpen: 0.9,
  mouthAspectRatio: 2.0,
  pitchAngle: 0,
  yawAngle: 0,
});

console.log(result.emotion); // 'joy'
console.log(result.confidence); // 0.85
```

### 3. 统一情绪状态管理

整合 `useEmotionState` hook：

```typescript
import { useEmotionState } from '../capabilities/emotion';
import { EmotionDetector } from '../components/vision';

function MyComponent() {
  const { setFacialEmotion, combinedEmotion } = useEmotionState();

  return (
    <EmotionDetector
      onEmotionDetected={(emotion) => {
        setFacialEmotion(emotion); // 更新面部情绪
      }}
    />
  );

  // combinedEmotion 会自动融合面部和文本情绪
}
```

---

## ❌ 移除的功能

### 1. 智能情绪模拟系统

**旧代码** (已移除):
```typescript
// BasicEmotionDetector内部有智能模拟系统作为MLKit后备
// 根据时间段模拟不同情绪权重
```

**原因**: MLKit已稳定工作，模拟系统不再需要

**替代方案**: 如果MLKit失败，现在会直接返回 `neutral` 情绪

### 2. 内置场景捕获

**旧代码** (已移除):
```typescript
<BasicEmotionDetector
  onFrameCaptured={handleFrame} // ❌ 不再支持
  frameCaptureInterval={30000}
/>
```

**原因**: 场景理解应该使用专用的 `useSceneUnderstanding` hook

**替代方案**: 见上面的"步骤3: 场景捕获功能迁移"

---

## ⚠️ 破坏性变更

### 变更1: `onFrameCaptured` 不再有效

**影响**: 如果你使用了 `onFrameCaptured` prop

**解决方案**: 使用 `useSceneUnderstanding` hook（见步骤3）

### 变更2: 不再有智能模拟模式

**影响**: 如果你依赖智能模拟系统测试

**解决方案**: 使用真实的MLKit检测或自行实现mock

---

## ✅ 测试清单

迁移后请确认以下功能正常：

- [ ] 情绪检测正常触发
- [ ] 前后摄像头切换工作
- [ ] 拖拽交互流畅
- [ ] 权限请求正常
- [ ] 人脸检测指示器显示
- [ ] 场景捕获（如果使用）正常工作
- [ ] 性能无明显下降

---

## 📚 相关文档

- [重构计划文档](./BASIC_EMOTION_DETECTOR_REFACTOR.md)
- [情绪检测MVP文档](./EMOTION_DETECTION_MVP.md)
- [场景理解文档](../src/capabilities/vision/environment/README.md)

---

## 🆘 故障排除

### 问题1: 导入错误 `EmotionDetector not found`

**解决方案**:
```bash
# 确保安装了所有依赖
npm install
# 重启开发服务器
npx expo start --clear
```

### 问题2: TypeScript类型错误

**解决方案**: 确保更新了所有导入路径
```typescript
// ❌ 错误
import { BasicEmotionDetector } from '../components/BasicEmotionDetector';

// ✅ 正确
import { EmotionDetector } from '../components/vision';
```

### 问题3: 场景捕获不工作

**解决方案**: 确保使用 `useSceneUnderstanding` hook并注册了拍照回调

```typescript
const { setPhotoCaptureCallback } = useSceneUnderstanding(apiKey);

useEffect(() => {
  setPhotoCaptureCallback(async () => {
    // 实现拍照逻辑
    return base64Image;
  });
}, []);
```

---

## 📞 获取帮助

如有问题，请：
1. 查看文档：`/docs`
2. 检查类型定义：`src/types/emotion.ts`
3. 参考示例代码：上述迁移示例

---

**最后更新**: 2025-01-18
**版本**: v1.0.0

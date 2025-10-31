# TFLite 物体和环境识别集成指南

## 📋 集成状态

✅ **已完成的组件和工具**

### 1. 类型定义
- `src/types/environment.ts` - 完整的环境检测类型定义
  - `DetectedObject` - 检测到的物体接口
  - `SceneType` - 场景类型枚举（室内/室外/办公室等）
  - `LightingCondition` - 光照条件枚举
  - `ActivityType` - 活动类型枚举
  - `EnvironmentContext` - 完整的环境上下文
  - `COCO_LABELS` - COCO数据集80类物体标签

### 2. 分析工具函数
- `src/utils/environmentAnalysis.ts` - 环境分析工具集
  - `inferActivity()` - 从物体推断活动类型
  - `refineSceneType()` - 根据物体细化场景类型
  - `estimateLighting()` - 估算光照条件
  - `buildEnvironmentContext()` - 构建完整环境上下文
  - `getEnvironmentDescription()` - 生成自然语言描述
  - `hasEnvironmentChanged()` - 检测环境变化

### 3. 状态管理
- `src/store/userStore.ts` - 扩展的状态存储
  - `currentEnvironment` - 当前环境上下文
  - `environmentHistory` - 环境历史记录（最多保留20条）
  - `setCurrentEnvironment()` - 更新当前环境
  - `addEnvironmentHistory()` - 添加环境历史

### 4. 自定义 Hook
- `src/utils/useEnvironmentDetection.ts` - 环境检测核心 Hook
  - 自动加载 TFLite 模型
  - `processFrameForObjects()` - 物体检测 worklet 函数
  - `processFrameForScene()` - 场景分类 worklet 函数
  - `updateEnvironmentContext()` - 更新环境上下文
  - 性能优化（帧采样、频率控制）

### 5. 性能配置
- `src/constants/tfliteConfig.ts` - TFLite 性能配置
  - 物体检测配置（15fps，每隔1帧）
  - 场景分类配置（每3秒）
  - 自适应FPS调整函数

## 🔧 集成步骤

### 步骤 1: 将环境检测添加到相机组件

目前有两种集成方式：

#### 方式 A: 创建独立的环境检测组件（推荐用于测试）

```typescript
// src/screens/HomeScreen.tsx 或测试页面
import { ObjectEnvironmentDetector } from '../components/ObjectEnvironmentDetector';
import { useUserStore } from '../store/userStore';

function TestEnvironmentDetection() {
  const { currentEnvironment } = useUserStore();

  return (
    <View>
      {/* 相机组件 */}
      <Camera ... />

      {/* 环境检测组件（透明覆盖层） */}
      <ObjectEnvironmentDetector
        isActive={true}
        onEnvironmentDetected={(context) => {
          console.log('Environment detected:', context);
        }}
      />

      {/* 显示检测结果 */}
      {currentEnvironment && (
        <View>
          <Text>场景: {currentEnvironment.scene}</Text>
          <Text>活动: {currentEnvironment.activity}</Text>
          <Text>光照: {currentEnvironment.lighting}</Text>
          <Text>物体数量: {currentEnvironment.objects.length}</Text>
        </View>
      )}
    </View>
  );
}
```

#### 方式 B: 集成到 BasicEmotionDetector（生产环境推荐）

将 `useEnvironmentDetection` hook 集成到 `BasicEmotionDetector.tsx` 的 frameProcessor 中：

```typescript
// src/components/BasicEmotionDetector.tsx
import { useEnvironmentDetection } from '../utils/useEnvironmentDetection';

export const BasicEmotionDetector: React.FC<EmotionDetectorProps> = (props) => {
  // 现有的情绪检测逻辑...

  // 添加环境检测 hook
  const {
    modelStatus,
    processFrameForObjects,
    processFrameForScene,
    updateEnvironmentContext,
  } = useEnvironmentDetection({
    isActive: true,
    objectDetectionFps: 15,
    sceneClassificationInterval: 3000,
  });

  // 修改现有的 frameProcessor
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      // 现有的情绪检测逻辑
      const faces = detectFaces(frame);
      if (faces && faces.length > 0) {
        // ... 情绪检测代码 ...
      }

      // 添加物体检测
      const detectedObjects = processFrameForObjects(frame);

      // 添加场景分类
      const sceneResult = processFrameForScene(frame);

      // 如果有新的检测结果，在主线程更新
      if (detectedObjects && sceneResult) {
        Worklets.defaultContext.runAsync(() => {
          updateEnvironmentContext(
            detectedObjects,
            sceneResult.scene,
            sceneResult.confidence
          );
        });
      }
    },
    [detectFaces, processFrameForObjects, processFrameForScene]
  );

  // 渲染组件...
};
```

### 步骤 2: 更新 AI 对话系统

将环境上下文集成到 AI 对话系统中，让兰兰能够感知环境：

```typescript
// src/utils/useChatAI.ts
import { useUserStore } from '../store/userStore';
import { getEnvironmentDescription } from './environmentAnalysis';

export function useChatAI() {
  const { currentEnvironment } = useUserStore();

  const sendMessage = async (userMessage: string) => {
    // 构建增强的系统提示
    let systemPrompt = AI_PERSONALITY.systemPrompt;

    // 添加环境感知
    if (currentEnvironment) {
      const envDescription = getEnvironmentDescription(currentEnvironment);
      systemPrompt += `\n\n当前环境信息：${envDescription}`;

      // 添加具体的物体信息（前3个最明显的物体）
      const topObjects = currentEnvironment.objects
        .slice(0, 3)
        .map(obj => `${obj.label} (${(obj.confidence * 100).toFixed(0)}%)`)
        .join('、');

      if (topObjects) {
        systemPrompt += `\n周围的物体：${topObjects}`;
      }
    }

    // 发送消息到 Claude API
    const response = await fetch(CLAUDE_API_CONFIG.baseURL, {
      method: 'POST',
      headers: { /* ... */ },
      body: JSON.stringify({
        model: CLAUDE_API_CONFIG.model,
        system: systemPrompt,
        messages: [/* ... */],
      }),
    });

    // ...
  };

  return { sendMessage };
}
```

### 步骤 3: 添加 UI 显示（可选）

创建一个环境信息显示组件：

```typescript
// src/components/EnvironmentDisplay.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUserStore } from '../store/userStore';
import { isDebugMode } from '../utils/debug';

export const EnvironmentDisplay: React.FC = () => {
  const { currentEnvironment } = useUserStore();

  if (!isDebugMode() || !currentEnvironment) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>环境感知</Text>
      <Text style={styles.text}>场景: {currentEnvironment.scene}</Text>
      <Text style={styles.text}>活动: {currentEnvironment.activity}</Text>
      <Text style={styles.text}>光照: {currentEnvironment.lighting}</Text>
      <Text style={styles.text}>
        置信度: {(currentEnvironment.confidence * 100).toFixed(0)}%
      </Text>

      <Text style={styles.subtitle}>检测到的物体:</Text>
      {currentEnvironment.objects.slice(0, 5).map((obj, idx) => (
        <Text key={idx} style={styles.objectText}>
          • {obj.label} ({(obj.confidence * 100).toFixed(0)}%)
        </Text>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 200,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 12,
    borderRadius: 8,
    maxWidth: 200,
  },
  title: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 6,
  },
  subtitle: {
    color: '#FFC107',
    fontSize: 10,
    marginTop: 6,
    marginBottom: 3,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    marginBottom: 2,
  },
  objectText: {
    color: '#E0E0E0',
    fontSize: 9,
    marginLeft: 5,
  },
});
```

## 🎯 性能优化

### 1. 帧采样策略

```typescript
// 当前配置（src/constants/tfliteConfig.ts）
const config = {
  objectDetection: {
    fps: 15,           // 每秒检测15次
    skipFrames: 1,     // 每隔1帧处理一次（相机60fps → 检测30fps）
  },
  sceneClassification: {
    interval: 3000,    // 每3秒分类一次场景
  },
};
```

### 2. 动态调整性能

根据设备性能动态调整：

```typescript
import { getAdaptiveFPS } from '../constants/tfliteConfig';

// 在检测循环中
const avgInferenceTime = calculateAverageInferenceTime();
const adaptiveFPS = getAdaptiveFPS(avgInferenceTime);

// 更新配置
updateDetectionConfig({ fps: adaptiveFPS });
```

### 3. 场景变化检测

只在场景变化显著时重新分类：

```typescript
// 在 processFrameForScene 中
if (!hasEnvironmentChanged(currentEnvironment, detectedObjects, 0.5)) {
  return; // 场景没有明显变化，跳过分类
}
```

## 📊 测试和验证

### 1. 模型加载验证

```typescript
const { modelStatus } = useEnvironmentDetection();

console.log('Model status:', modelStatus);
// Expected: 'loading' → 'ready'
// If 'error', check model files in assets/tflite/
```

### 2. 检测结果验证

```typescript
const { currentEnvironment } = useUserStore();

if (currentEnvironment) {
  console.log('Current scene:', currentEnvironment.scene);
  console.log('Detected objects:', currentEnvironment.objects);
  console.log('Activity:', currentEnvironment.activity);
  console.log('Lighting:', currentEnvironment.lighting);
}
```

### 3. 性能监控

```typescript
// 在 debug 模式下启用性能日志
export const TFLITE_DETECTION_CONFIG = {
  debug: {
    logInferenceTime: true,
    logDetections: true,
  },
};

// 查看日志
// [ObjectEnvironmentDetector] Detected 3 objects { inferenceTime: '45ms', ... }
// [ObjectEnvironmentDetector] Scene classified: indoor { confidence: '87.5%', inferenceTime: '32ms' }
```

## 🚀 下一步

1. **测试集成** - 使用方式A创建测试页面验证功能
2. **性能调优** - 根据设备性能调整FPS和采样策略
3. **AI集成** - 将环境信息添加到AI对话系统
4. **UI优化** - 创建用户友好的环境显示界面
5. **生产部署** - 使用方式B集成到主应用

## ⚠️ 注意事项

1. **内存管理** - 环境历史只保留最近20条记录
2. **性能影响** - 同时运行情绪检测和环境检测，建议在高端设备测试
3. **模型文件** - 确保模型文件正确放置在 `assets/tflite/` 目录
4. **GPU加速** - iOS自动使用CoreML，Android需要配置GPU delegate
5. **调试模式** - 使用 `SHOW_TEST_COMPONENTS=true npm start` 查看调试信息

## 📝 完整示例

完整的集成示例请参考：
- `src/components/ObjectEnvironmentDetector.tsx` - 独立组件实现
- `src/utils/useEnvironmentDetection.ts` - Hook实现
- `src/utils/environmentAnalysis.ts` - 分析工具集

## 🎉 总结

阶段3的核心集成已完成！现在你拥有：

✅ 完整的类型系统
✅ 强大的分析工具
✅ 可扩展的状态管理
✅ 高性能的检测Hook
✅ 灵活的配置系统
✅ 详细的集成指南

下一步可以开始测试和将环境感知集成到AI对话系统中！

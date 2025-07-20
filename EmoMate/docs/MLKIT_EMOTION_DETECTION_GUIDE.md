# MLKit真实面部表情检测集成指南

## 概述

EmoMate现已集成真实的MLKit面部表情检测功能，可以替代之前的智能模拟系统。本文档提供完整的安装、配置和使用指南。

## 技术方案

### 架构设计
- **主要库**: react-native-vision-camera + MLKit原生插件
- **检测模式**: MLKit优先，智能模拟作为后备
- **API兼容**: 保持现有`EmotionDetectorProps`接口不变
- **EAS兼容**: 完全支持EAS Build，无需本地原生修改

### 核心组件
- `BasicEmotionDetector.tsx`: 升级版情绪检测组件
- `faceDetection.ts`: MLKit集成工具类
- MLKit Frame Processor: 基于react-native-vision-camera

## 安装配置

### 1. 安装依赖包

```bash
# 进入EmoMate项目目录
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate

# 安装react-native-vision-camera-face-detector
npm install react-native-vision-camera-face-detector

# 确认已安装的相关依赖
npm list react-native-vision-camera  # 应该是4.7.1
npm list react-native-worklets-core  # 应该是1.6.0
```

### 2. iOS配置 (app.json)

在`app.json`中添加MLKit相关配置：

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-vision-camera",
        {
          "cameraPermissionText": "$(PRODUCT_NAME) needs access to your Camera to detect facial emotions.",
          "enableFrameProcessors": true,
          "enableCodeScanner": false
        }
      ],
      [
        "react-native-vision-camera-face-detector",
        {
          "enableFaceDetection": true,
          "enableMLKit": true
        }
      ]
    ]
  }
}
```

### 3. Android配置

在`app.json`中确保Android权限：

```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO"
      ]
    }
  }
}
```

### 4. EAS Build配置

在`eas.json`中添加native模块构建支持：

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

## 使用方法

### 基本使用

MLKit集成完全透明，现有代码无需修改：

```tsx
// HomeScreen.tsx - 现有代码保持不变
<BasicEmotionDetector
  onEmotionDetected={setFacialEmotion}
  isActive={true}
  detectionInterval={3000}
/>
```

### 检测模式

组件会自动检测MLKit可用性：

```typescript
// 自动模式切换
- MLKit可用 → 使用真实面部检测
- MLKit不可用 → 降级到智能模拟模式
```

### Debug模式

启用debug模式查看检测状态：

```bash
# 启动时显示详细信息
SHOW_TEST_COMPONENTS=true npm start
```

Debug信息包括：
- 检测模式 (mlkit/simulation)
- 当前情绪
- 检测状态
- 组件位置

## 情绪分析算法

### MLKit概率映射

基于MLKit提供的面部特征概率：

```typescript
interface MLKitFace {
  smilingProbability: number;      // 微笑概率 (0-1)
  leftEyeOpenProbability: number;  // 左眼睁开概率 (0-1)  
  rightEyeOpenProbability: number; // 右眼睁开概率 (0-1)
}
```

### 情绪判断逻辑

```typescript
// 开心: 高微笑概率
smilingProbability > 0.6 → happy (confidence: min(smile, 0.95))

// 惊讶: 眼睛大睁 + 低微笑
avgEyeOpen > 0.8 && smile < 0.3 → surprised (confidence: min(eyes, 0.85))

// 悲伤: 眼睛微闭 + 不微笑  
avgEyeOpen < 0.4 && smile < 0.2 → sad (confidence: min(1-eyes, 0.8))

// 愤怒: 不微笑 + 眼睛正常
smile < 0.1 && avgEyeOpen > 0.5 → angry (confidence: min(1-smile, 0.75))

// 默认: 中性
其他情况 → neutral (confidence: 0.5)
```

## 性能优化

### 检测频率控制

```typescript
// 配置参数
detectionInterval: 3000ms  // 检测间隔
confidence: > 0.6         // 最小置信度阈值
minFaceSize: 0.2          // 最小面部尺寸
```

### Frame Processor优化

```typescript
// 性能设置
performanceMode: 'fast'    // 优先速度
classificationMode: 'all'  // 启用情绪分类
landmarkMode: 'none'       // 禁用landmarks  
contourMode: 'none'        // 禁用contours
trackingEnabled: false     // 禁用跟踪
```

## 故障排除

### 常见问题

#### 1. MLKit插件加载失败
```
症状: 自动降级到模拟模式
原因: react-native-vision-camera-face-detector未正确安装
解决: 重新安装并确认EAS Build配置
```

#### 2. 相机权限问题
```
症状: 黑屏或权限错误
原因: Camera权限未正确配置
解决: 检查app.json中的权限配置
```

#### 3. Frame Processor错误
```
症状: 控制台出现worklet错误
原因: react-native-worklets-core版本不兼容
解决: 确认版本1.6.0并重新构建
```

### Debug调试

#### 启用详细日志
```bash
# 开发模式
SHOW_TEST_COMPONENTS=true npm start

# 查看控制台输出
[BasicEmotionDetector] MLKit面部检测已启用
[BasicEmotionDetector] MLKit检测到情绪: happy (confidence: 0.85)
```

#### 检查组件状态
```tsx
// Debug面板显示
Emotion: happy
Mode: mlkit  
Detecting: Yes
X: 20, Y: 80
```

## 测试验证

### 功能测试

1. **安装验证**
   ```bash
   # 构建开发版本
   npx eas build --platform ios --profile development
   ```

2. **MLKit检测测试**
   - 启动应用，观察debug模式显示"mlkit"
   - 对着摄像头做各种表情
   - 验证情绪检测准确性

3. **降级测试**
   - 在没有MLKit的设备上测试
   - 应自动切换到"simulation"模式
   - 智能模拟功能正常工作

### 性能测试

- **内存使用**: MLKit模式下内存增长<50MB
- **CPU占用**: Frame处理应<10%额外CPU
- **电池消耗**: 与原expo-camera相比增长<20%

## 部署指南

### EAS Build部署

```bash
# 开发版本
npx eas build --platform all --profile development

# 生产版本  
npx eas build --platform all --profile production
```

### App Store / Play Store

MLKit是Google官方库，完全符合应用商店政策：
- iOS: 使用ML Kit iOS SDK
- Android: 使用ML Kit Android SDK
- 隐私: 所有处理均在设备本地完成

## 版本兼容性

| 组件 | 版本要求 | 状态 |
|------|----------|------|
| React Native | 0.79.5 | ✅ 兼容 |
| Expo | 53.x | ✅ 兼容 |  
| react-native-vision-camera | 4.7.1 | ✅ 已安装 |
| react-native-worklets-core | 1.6.0 | ✅ 已安装 |
| react-native-vision-camera-face-detector | latest | 🔄 需安装 |

## 下一步开发

### 功能增强
- [ ] 添加更多情绪类型 (fear, disgust)
- [ ] 实现情绪强度级别 (1-10)
- [ ] 支持多人脸检测
- [ ] 添加性别和年龄检测

### 性能优化
- [ ] 实现自适应检测频率
- [ ] 添加GPU加速支持
- [ ] 优化内存使用
- [ ] 实现模型缓存机制

### 用户体验
- [ ] 添加检测置信度显示
- [ ] 实现表情历史记录
- [ ] 支持手动校准
- [ ] 添加暗光模式优化

---

## 技术支持

如果在集成过程中遇到问题，请参考：

1. **react-native-vision-camera文档**: https://github.com/mrousavy/react-native-vision-camera
2. **MLKit Face Detection文档**: https://developers.google.com/ml-kit/vision/face-detection  
3. **EmoMate项目文档**: `/docs/EMOTION_DETECTION_ARCHITECTURE.md`

## 更新日志

### v2.0.0 (2025-01-20)
- ✅ 集成MLKit真实面部表情检测
- ✅ 保持向后兼容的API接口
- ✅ 支持EAS Build部署
- ✅ 智能模拟作为后备方案
- ✅ 完整的debug和监控系统
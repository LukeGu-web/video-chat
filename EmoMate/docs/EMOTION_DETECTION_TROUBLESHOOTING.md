# 情绪检测故障排除指南

## 🚨 常见问题快速解决

### 问题分类索引
- [依赖冲突问题](#依赖冲突问题)
- [摄像头相关问题](#摄像头相关问题)  
- [动画和UI问题](#动画和UI问题)
- [性能问题](#性能问题)
- [Build和部署问题](#Build和部署问题)

---

## 🔧 依赖冲突问题

### 1. Module "1337/1340" 错误

#### 错误描述
```
ERROR Error: Requiring unknown module "1337". If you are sure the module exists, 
try restarting Metro. You may also want to run `yarn` or `npm install`., 
js engine: hermes
```

#### 根本原因
- `react-native-vision-camera-face-detector` 与 `react-native-worklets-core` 版本冲突
- Metro bundler 无法正确解析 worklets 相关模块

#### ✅ 解决方案
```bash
# 1. 移除有问题的包
npm uninstall react-native-vision-camera-face-detector

# 2. 清理缓存
npx expo start --clear

# 3. 使用 BasicEmotionDetector 替代
import { BasicEmotionDetector } from '../components';
```

#### 🔍 验证修复
```typescript
// 检查应用是否正常启动
<BasicEmotionDetector
  onEmotionDetected={(emotion) => console.log('Detected:', emotion)}
  isActive={true}
  detectionInterval={3000}
/>
```

### 2. Worklets插件冲突

#### 错误描述
```
Error: Execution failed for task ':react-native-vision-camera-face-detector:compileDebugKotlin'
```

#### ✅ 解决方案
```javascript
// babel.config.js - 确保插件顺序正确
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // worklets-core 必须在 reanimated 之前
      'react-native-worklets-core/plugin',
      'react-native-reanimated/plugin',
    ],
  };
};
```

### 3. Metro配置问题

#### 错误描述
- Bundle构建失败
- 模块解析错误

#### ✅ 解决方案
```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// 优化配置避免冲突
config.resolver.platforms = ['ios', 'android', 'native', 'web'];
config.transformer = {
  ...config.transformer,
  inlineRequires: false, // 关键：避免worklets冲突
  minifierConfig: {
    mangle: { keep_fnames: true }
  }
};

module.exports = withNativeWind(config, { input: './global.css' });
```

---

## 📷 摄像头相关问题

### 1. CameraType.front 未定义

#### 错误描述
```
TypeError: Cannot read property 'front' of undefined
```

#### 根本原因
- Expo Camera v16 API变更
- `CameraType` 不再是枚举，改为字符串类型

#### ✅ 解决方案
```typescript
// ❌ 错误写法
import { CameraView, CameraType } from 'expo-camera';
<CameraView facing={CameraType.front} />

// ✅ 正确写法  
import { CameraView, type CameraType } from 'expo-camera';
<CameraView facing="front" />
```

### 2. 摄像头权限问题

#### 错误描述
- 摄像头黑屏
- Permission denied

#### ✅ 解决方案
```typescript
// 1. 检查权限状态
const [permission, requestPermission] = useCameraPermissions();

// 2. 权限处理逻辑
useEffect(() => {
  if (!permission?.granted) {
    requestPermission();
  }
}, [permission, requestPermission]);

// 3. 用户友好的权限提示
if (!permission?.granted) {
  return (
    <View style={styles.permissionContainer}>
      <Text>摄像头权限需要开启才能使用情绪检测功能</Text>
      <TouchableOpacity onPress={requestPermission}>
        <Text>授权摄像头</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 3. iOS摄像头配置问题

#### 错误描述
- iOS设备摄像头无法启动
- 权限弹窗不显示

#### ✅ 解决方案
```typescript
// app.config.ts - 确保权限描述正确
ios: {
  infoPlist: {
    NSCameraUsageDescription: 
      'EmoMate需要访问摄像头来进行面部表情分析，所有数据仅在本地处理。',
    NSMicrophoneUsageDescription:
      'EmoMate需要访问麦克风用于语音交互功能。'
  }
}
```

---

## 🎨 动画和UI问题

### 1. 拖拽不响应

#### 症状
- 组件无法拖拽移动
- 触摸事件不响应

#### ✅ 解决方案
```typescript
// 检查PanResponder配置
const panResponder = PanResponder.create({
  onMoveShouldSetPanResponder: () => true, // 确保返回true
  onPanResponderGrant: () => {
    scale.value = withSpring(0.95);
  },
  onPanResponderMove: (_evt, gestureState) => {
    // 确保边界检查正确
    const newX = Math.max(0, Math.min(
      SCREEN_WIDTH - CONTAINER_WIDTH, 
      position.x + gestureState.dx
    ));
    const newY = Math.max(0, Math.min(
      SCREEN_HEIGHT - CONTAINER_HEIGHT,
      position.y + gestureState.dy
    ));
    setPosition({ x: newX, y: newY });
  }
});

// 确保应用到组件
<AnimatedView 
  style={containerStyle} 
  {...panResponder.panHandlers} // 关键
>
```

### 2. Reanimated动画卡顿

#### 症状
- 动画不流畅
- UI线程阻塞

#### ✅ 解决方案
```typescript
// 1. 使用worklet标记
const animatedStyle = useAnimatedStyle(() => {
  'worklet'; // 确保在UI线程执行
  return {
    transform: [{ scale: scale.value }],
  };
});

// 2. 避免在动画中使用非worklet函数
const updateAnimation = useCallback(() => {
  'worklet';
  scale.value = withSpring(1.05);
}, []);

// 3. 使用runOnUI传递数据
const updateFromJS = (newValue: number) => {
  runOnUI(() => {
    'worklet';
    scale.value = withSpring(newValue);
  })();
};
```

### 3. 情绪指示器显示异常

#### 症状
- Emoji不显示或显示错误
- 状态指示器位置错乱

#### ✅ 解决方案
```typescript
// 1. 确保Emoji映射完整
const EMOTION_EMOJIS: Record<EmotionType, string> = {
  happy: '😊',
  sad: '😔',
  surprised: '😮', 
  angry: '😤',
  neutral: '😐'
};

// 2. 检查条件渲染逻辑
<View style={styles.emotionDisplay}>
  <View style={[
    styles.emotionIndicator, 
    currentEmotion !== 'neutral' && styles.activeIndicator
  ]}>
    <Text style={styles.emotionText}>
      {EMOTION_EMOJIS[currentEmotion] || '😐'}
    </Text>
  </View>
</View>

// 3. 样式位置检查
const styles = StyleSheet.create({
  emotionDisplay: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
```

---

## ⚡ 性能问题

### 1. 情绪检测频率过高

#### 症状
- CPU使用率高
- 电池消耗快
- 应用发热

#### ✅ 解决方案
```typescript
// 1. 调整检测间隔
<BasicEmotionDetector
  detectionInterval={5000} // 增加到5秒
  isActive={true}
/>

// 2. 添加节流控制
const useThrottledEmotionDetection = (interval: number) => {
  const lastDetectionTime = useRef(0);
  
  const throttledDetection = useCallback((callback: () => void) => {
    const now = Date.now();
    if (now - lastDetectionTime.current >= interval) {
      lastDetectionTime.current = now;
      callback();
    }
  }, [interval]);
  
  return throttledDetection;
};

// 3. 基于应用状态暂停检测
useEffect(() => {
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background') {
      setIsActive(false); // 后台暂停检测
    } else if (nextAppState === 'active') {
      setIsActive(true);  // 前台恢复检测
    }
  };
  
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription?.remove();
}, []);
```

### 2. 内存泄漏问题

#### 症状
- 应用运行一段时间后卡顿
- 内存使用持续增长

#### ✅ 解决方案
```typescript
// 1. 确保定时器清理
useEffect(() => {
  const interval = setInterval(simulateEmotionDetection, detectionInterval);
  
  return () => {
    clearInterval(interval); // 关键：清理定时器
  };
}, [simulateEmotionDetection, detectionInterval]);

// 2. 清理动画值
useEffect(() => {
  return () => {
    scale.value = 1;
    // 重置所有共享值
  };
}, []);

// 3. 清理事件监听器
useEffect(() => {
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  
  return () => {
    subscription?.remove(); // 清理监听器
  };
}, []);

// 4. 使用WeakMap缓存
const emotionCache = new WeakMap<object, EmotionType>();
```

### 3. UI渲染性能问题

#### 症状
- 滚动卡顿
- 动画掉帧

#### ✅ 解决方案
```typescript
// 1. 使用React.memo避免不必要渲染
const BasicEmotionDetector = React.memo<EmotionDetectorProps>(
  ({ onEmotionDetected, isActive, detectionInterval }) => {
    // 组件实现
  },
  (prevProps, nextProps) => {
    return prevProps.isActive === nextProps.isActive &&
           prevProps.detectionInterval === nextProps.detectionInterval;
  }
);

// 2. 优化useCallback依赖
const simulateEmotionDetection = useCallback(() => {
  // 检测逻辑
}, [isActive, detectionInterval]); // 精确依赖

// 3. 使用useMemo缓存计算
const emotionWeights = useMemo(() => {
  return calculateEmotionWeights(new Date().getHours());
}, [Math.floor(Date.now() / (1000 * 60 * 60))]); // 每小时更新一次
```

---

## 🔨 Build和部署问题

### 1. EAS Build失败

#### 错误描述
```
Failed to build iOS app
Error: No profiles for 'com.lukeguexpo.emomate' were found
```

#### ✅ 解决方案
```bash
# 1. 检查EAS配置
cat eas.json

# 2. 更新development profile
eas build --platform ios --profile development --clear-cache

# 3. 检查bundle identifier
# 确保app.config.ts中的bundleIdentifier正确
```

### 2. Android构建错误

#### 错误描述
```
Execution failed for task ':app:compileDebugJavaWithJavac'
```

#### ✅ 解决方案
```bash
# 1. 清理Android构建缓存
cd android
./gradlew clean

# 2. 重新构建
cd ..
npx expo run:android

# 3. 检查JDK版本
java -version # 确保使用JDK 11或17
```

### 3. iOS Podfile问题

#### 错误描述
```
[!] CocoaPods could not find compatible versions for pod "react-native-worklets-core"
```

#### ✅ 解决方案
```bash
# 1. 清理Pods缓存
cd ios
rm -rf Pods Podfile.lock
pod deintegrate

# 2. 重新安装
pod install

# 3. 如果问题持续，检查Podfile平台版本
# ios/Podfile
platform :ios, '15.5' # 确保版本兼容
```

---

## 🐛 调试工具和方法

### 1. Debug模式启用

#### 启用Debug日志
```bash
# 启动时开启debug模式
SHOW_TEST_COMPONENTS=true npm start
```

#### Debug输出示例
```typescript
// 使用debugLog记录关键信息
debugLog('BasicEmotionDetector', 'Intelligent emotion simulation: happy', {
  timeOfDay: 14,
  probability: 0.3,
  previousEmotion: 'neutral'
});
```

### 2. 性能分析工具

#### React DevTools Profiler
```typescript
// 包装组件进行性能分析
import { Profiler } from 'react';

const onRenderCallback = (id, phase, actualDuration) => {
  console.log('Render performance:', { id, phase, actualDuration });
};

<Profiler id="BasicEmotionDetector" onRender={onRenderCallback}>
  <BasicEmotionDetector {...props} />
</Profiler>
```

#### Flipper调试
```typescript
// 使用Flipper网络调试
if (__DEV__) {
  import('flipper').then(flipper => {
    flipper.logger.info('Emotion detection initialized');
  });
}
```

### 3. 实时监控

#### Metro错误监控
```javascript
// metro.config.js - 添加错误监控
config.reporter = {
  update: (event) => {
    if (event.type === 'bundling_error') {
      console.error('[Metro] Bundling error:', event.error);
      // 可以添加错误上报逻辑
    }
  },
};
```

#### 应用健康检查
```typescript
// 添加健康检查函数
const useHealthCheck = () => {
  useEffect(() => {
    const healthCheck = setInterval(() => {
      // 检查关键组件状态
      const isEmotionDetectorHealthy = checkEmotionDetectorHealth();
      if (!isEmotionDetectorHealthy) {
        console.warn('Emotion detector health check failed');
      }
    }, 30000); // 每30秒检查一次
    
    return () => clearInterval(healthCheck);
  }, []);
};
```

---

## 📞 获取帮助

### 1. 日志收集

#### 完整错误信息收集
```bash
# 1. 收集Metro日志
npx expo start --clear > metro.log 2>&1

# 2. 收集设备日志
# iOS
xcrun simctl spawn booted log stream --predicate 'process == "EmoMate"'

# Android  
adb logcat | grep EmoMate
```

#### 系统信息收集
```bash
# 检查环境信息
npx expo doctor

# 依赖版本信息
npm list --depth=0
```

### 2. 问题报告模板

```markdown
## 问题描述
[简要描述遇到的问题]

## 环境信息
- EmoMate版本: [版本号]
- React Native版本: [版本]
- Expo版本: [版本]
- 平台: iOS/Android [版本]
- 设备: [设备型号]

## 复现步骤
1. [步骤1]
2. [步骤2] 
3. [步骤3]

## 预期行为
[描述应该发生什么]

## 实际行为
[描述实际发生了什么]

## 错误日志
```
[粘贴相关错误日志]
```

## 尝试过的解决方法
[列出已经尝试的解决方案]
```

### 3. 社区资源

#### 相关文档链接
- [Expo Camera文档](https://docs.expo.dev/versions/latest/sdk/camera/)
- [React Native Reanimated文档](https://docs.swmansion.com/react-native-reanimated/)
- [Vision Camera文档](https://react-native-vision-camera.com/)

#### 已知问题追踪
- [Vision Camera Issues](https://github.com/mrousavy/react-native-vision-camera/issues)
- [Expo Issues](https://github.com/expo/expo/issues)
- [Reanimated Issues](https://github.com/software-mansion/react-native-reanimated/issues)

---

*故障排除指南版本: 1.0.0*  
*最后更新: 2025-01-20*  
*适用于: EmoMate情绪检测MVP*
# 情绪检测技术架构文档

## 🏗️ 系统架构概览

### 多层架构设计
```
┌─────────────────────────────────────────────────────────────┐
│                    UI Layer (React Native)                  │
├─────────────────────────────────────────────────────────────┤
│  BasicEmotionDetector  │  EmotionAwareCharacter  │  UI组件  │
├─────────────────────────────────────────────────────────────┤
│                   Business Logic Layer                      │
├─────────────────────────────────────────────────────────────┤
│     EmotionProvider    │    EmotionAnalysis    │   Debug    │
├─────────────────────────────────────────────────────────────┤
│                   Data Layer & APIs                         │
├─────────────────────────────────────────────────────────────┤
│    Expo Camera API     │     Zustand Store     │  Context   │
├─────────────────────────────────────────────────────────────┤
│                   Platform Layer                            │
├─────────────────────────────────────────────────────────────┤
│      iOS (Swift)      │    Android (Kotlin)   │   Hermes   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 核心组件设计

### 1. BasicEmotionDetector 组件

#### 组件职责
- **主要职责**: 面部情绪检测和用户交互
- **输入**: 摄像头视频流
- **输出**: EmotionType 情绪事件
- **UI特性**: 可拖拽、动画反馈、状态指示

#### 技术实现
```typescript
// 核心Hook组合
const BasicEmotionDetector: React.FC<EmotionDetectorProps> = (props) => {
  // 1. 权限管理
  const [permission, requestPermission] = useCameraPermissions();
  
  // 2. 动画系统  
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));
  
  // 3. 拖拽处理
  const panResponder = PanResponder.create({...});
  
  // 4. 智能情绪算法
  const simulateEmotionDetection = useCallback(() => {
    // 时间感知 + 权重随机算法
  }, []);
  
  // 5. 生命周期管理
  useEffect(() => { /* 定时器和清理 */ }, []);
};
```

#### 算法核心: 智能情绪模拟
```typescript
interface EmotionWeights {
  happy: number;
  neutral: number; 
  surprised: number;
  sad: number;
  angry: number;
}

// 时间感知权重计算
const calculateEmotionWeights = (hour: number): EmotionWeights => {
  if (hour >= 6 && hour < 12) {
    // 早上: 积极情绪偏重
    return { happy: 0.4, neutral: 0.4, surprised: 0.15, sad: 0.03, angry: 0.02 };
  } else if (hour >= 12 && hour < 18) {
    // 下午: 平衡分布
    return { happy: 0.3, neutral: 0.5, surprised: 0.1, sad: 0.07, angry: 0.03 };
  } else {
    // 晚上: 平静为主
    return { happy: 0.25, neutral: 0.6, surprised: 0.08, sad: 0.05, angry: 0.02 };
  }
};

// 累积概率选择算法
const selectEmotionByWeight = (weights: EmotionWeights): EmotionType => {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [emotion, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (rand <= cumulative) {
      return emotion as EmotionType;
    }
  }
  return 'neutral';
};
```

### 2. EmotionProvider 状态管理

#### Context架构
```typescript
interface EmotionContextType {
  // 状态读取
  facialEmotion: EmotionType | null;
  textEmotion: EmotionType | null;
  combinedEmotion: EmotionType;
  lastUpdated: number;
  
  // 状态更新
  setFacialEmotion: (emotion: EmotionType) => void;
  setTextEmotion: (emotion: EmotionType) => void;
}

// 组合情绪计算逻辑
const calculateCombinedEmotion = (
  facial: EmotionType | null,
  text: EmotionType | null
): EmotionType => {
  // 1. 面部检测优先策略
  if (facial && facial !== 'neutral') return facial;
  
  // 2. 文本情绪补充策略  
  if (text && text !== 'neutral') return text;
  
  // 3. 默认中性状态
  return 'neutral';
};
```

#### 状态持久化
```typescript
// Zustand集成 (可选)
interface EmotionStore {
  emotionHistory: EmotionDetectionResult[];
  addEmotionLog: (emotion: EmotionType) => void;
  getEmotionStats: () => EmotionStats;
}

const useEmotionStore = create<EmotionStore>()(
  immer((set, get) => ({
    emotionHistory: [],
    addEmotionLog: (emotion) => set((state) => {
      state.emotionHistory.push({
        emotion,
        confidence: 0.8, // 模拟置信度
        timestamp: Date.now()
      });
    }),
    getEmotionStats: () => {
      // 统计分析逻辑
    }
  }))
);
```

### 3. EmotionAwareCharacter 响应系统

#### 情绪映射策略
```typescript
// 情绪到动画的映射表
const EMOTION_ANIMATION_MAP: Record<EmotionType, string> = {
  happy: 'Happy',
  sad: 'Sad',
  surprised: 'Surprised', 
  angry: 'Angry',
  neutral: 'Idle'
};

// Live2D集成逻辑
const EmotionAwareCharacter: React.FC = () => {
  const { combinedEmotion } = useEmotionContext();
  
  useEffect(() => {
    const animation = EMOTION_ANIMATION_MAP[combinedEmotion];
    // 触发Live2D动画
    triggerHiyoriAnimation(animation);
  }, [combinedEmotion]);
  
  return <Live2DCharacter />;
};
```

---

## 🔧 依赖关系和版本策略

### 当前稳定技术栈
```json
{
  "core": {
    "react": "19.0.0",
    "react-native": "0.79.5",
    "expo": "53.0.20",
    "typescript": "~5.8.3"
  },
  "camera": {
    "expo-camera": "~16.1.11"
  },
  "animation": {
    "react-native-reanimated": "~3.17.4",
    "react-native-gesture-handler": "~2.24.0"
  },
  "future": {
    "react-native-vision-camera": "^4.7.1",
    "react-native-worklets-core": "^1.6.0"
  }
}
```

### 版本策略分析

#### ✅ 当前稳定组合
- **Expo Camera**: 成熟稳定，iOS/Android兼容性好
- **Reanimated 3.17**: 与RN 0.79.5完美配合
- **Gesture Handler**: 拖拽功能无冲突

#### 🔄 预留升级路径
```typescript
// Phase 2: 真实MLKit集成准备
import {
  useCameraDevice, 
  useFrameProcessor,
  Camera as VisionCamera
} from 'react-native-vision-camera';

// Phase 3: 自定义Frame Processor
const faceDetectionProcessor = useFrameProcessor((frame) => {
  'worklet';
  // 直接调用MLKit Native API
  const faces = detectFacesNative(frame);
  // 绕过face-detector包的依赖问题
}, []);
```

#### ❌ 已解决的依赖冲突
```bash
# 移除的问题包
react-native-vision-camera-face-detector@1.8.6

# 冲突原因分析
react-native-vision-camera-face-detector → react-native-worklets-core@1.5.0
react-native-reanimated@3.17.4 → react-native-worklets-core@1.3.x
# 版本不兼容导致Metro bundler解析失败
```

---

## 🎨 UI/UX设计模式

### 1. 响应式拖拽系统

#### 手势处理架构
```typescript
const createDragGesture = () => {
  const position = useSharedValue({ x: 20, y: 80 });
  const scale = useSharedValue(1);
  
  return PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      // 拖拽开始: 缩放反馈
      scale.value = withSpring(0.95);
    },
    onPanResponderMove: (_, gestureState) => {
      // 实时位置更新 + 边界限制
      const newX = Math.max(0, Math.min(SCREEN_WIDTH - WIDTH, 
        position.value.x + gestureState.dx));
      const newY = Math.max(0, Math.min(SCREEN_HEIGHT - HEIGHT,
        position.value.y + gestureState.dy));
      position.value = { x: newX, y: newY };
    },
    onPanResponderRelease: () => {
      // 拖拽结束: 恢复缩放
      scale.value = withSpring(1);
    }
  });
};
```

#### 视觉反馈系统
```typescript
// 情绪状态视觉映射
const getEmotionStyle = (emotion: EmotionType, isActive: boolean) => ({
  borderColor: isActive ? EMOTION_COLORS[emotion] : '#e9ecef',
  backgroundColor: isActive ? 
    `${EMOTION_COLORS[emotion]}20` : '#f8f9fa',
  transform: [
    { scale: isActive ? 1.05 : 1 }
  ]
});

const EMOTION_COLORS = {
  happy: '#22c55e',    // 绿色
  sad: '#3b82f6',      // 蓝色  
  surprised: '#f59e0b', // 橙色
  angry: '#ef4444',    // 红色
  neutral: '#6b7280'   // 灰色
};
```

### 2. 状态指示器设计

#### 多层次反馈
```typescript
// 1. 情绪Emoji显示
const EmotionEmoji = ({ emotion }: { emotion: EmotionType }) => (
  <Text style={styles.emotionText}>
    {EMOTION_EMOJIS[emotion]}
  </Text>
);

// 2. 检测状态指示器
const DetectionIndicator = ({ isDetecting }: { isDetecting: boolean }) => (
  isDetecting ? (
    <View style={styles.detectingIndicator}>
      <Text style={styles.detectingText}>●</Text>
    </View>
  ) : null
);

// 3. Debug信息叠加
const DebugOverlay = ({ emotion, position, isDetecting }) => (
  isDebugMode() ? (
    <View style={styles.debugOverlay}>
      <Text>Emotion: {emotion}</Text>
      <Text>Position: {position.x}, {position.y}</Text>
      <Text>Detecting: {isDetecting ? 'Yes' : 'No'}</Text>
    </View>
  ) : null
);
```

---

## 🔍 Debug和监控系统

### 1. 分层Debug架构

#### Debug工具链
```typescript
// 1. 环境变量控制
const isDebugMode = (): boolean => {
  return Constants.expoConfig?.extra?.showTestComponents === true;
};

// 2. 组件级Debug日志
export const debugLog = (component: string, message: string, data?: any) => {
  if (!isDebugMode()) return;
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${component}] ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
};

// 3. 性能计时器
export class DebugTimer {
  constructor(private component: string, private label: string) {
    this.startTime = Date.now();
    debugLog(this.component, `Timer started: ${this.label}`);
  }
  
  end(): number {
    const duration = Date.now() - this.startTime;
    debugLog(this.component, `Timer ended: ${this.label} (${duration}ms)`);
    return duration;
  }
}
```

#### Metro配置监控
```javascript
// metro.config.js - Debug增强
config.reporter = {
  update: (event) => {
    if (event.type === 'bundle_build_started') {
      console.log(`[Metro] Bundle build started for ${event.bundleDetails.platform}`);
    } else if (event.type === 'bundling_error') {
      console.error('[Metro] Bundling error:', event.error);
    }
  },
};
```

### 2. 实时监控指标

#### 性能监控
```typescript
interface PerformanceMetrics {
  // 组件性能
  initializationTime: number;      // 初始化耗时
  emotionDetectionLatency: number; // 情绪检测延迟
  uiResponseTime: number;          // UI响应时间
  
  // 系统性能  
  memoryUsage: number;             // 内存占用
  cpuUsage: number;                // CPU使用率
  batteryImpact: 'low' | 'medium' | 'high'; // 电池影响
  
  // 用户体验
  dragResponsiveness: number;      // 拖拽响应性
  animationFrameRate: number;      // 动画帧率
}

// 性能数据收集
const usePerformanceMonitor = () => {
  const metrics = useRef<PerformanceMetrics>({
    initializationTime: 0,
    emotionDetectionLatency: 0,
    // ... 其他指标
  });
  
  const recordMetric = (key: keyof PerformanceMetrics, value: number) => {
    metrics.current[key] = value;
    debugLog('PerformanceMonitor', `${key}: ${value}`, metrics.current);
  };
  
  return { metrics: metrics.current, recordMetric };
};
```

---

## 🚀 扩展性设计

### 1. 插件化架构

#### 情绪检测插件接口
```typescript
interface EmotionDetectionPlugin {
  name: string;
  version: string;
  
  // 核心接口
  initialize(): Promise<void>;
  detectEmotion(input: any): Promise<EmotionDetectionResult>;
  cleanup(): void;
  
  // 元数据
  getSupportedEmotions(): EmotionType[];
  getCapabilities(): DetectionCapabilities;
}

// 插件实现示例
class MLKitEmotionPlugin implements EmotionDetectionPlugin {
  name = 'MLKit Face Detection';
  version = '1.0.0';
  
  async initialize() {
    // MLKit 初始化
  }
  
  async detectEmotion(frame: Frame): Promise<EmotionDetectionResult> {
    // 真实的MLKit检测逻辑
    const faces = await this.mlkitDetector.detect(frame);
    return this.analyzeFaceData(faces[0]);
  }
  
  // ... 其他实现
}
```

#### 插件管理器
```typescript
class EmotionDetectionManager {
  private plugins: Map<string, EmotionDetectionPlugin> = new Map();
  private activePlugin: EmotionDetectionPlugin | null = null;
  
  registerPlugin(plugin: EmotionDetectionPlugin) {
    this.plugins.set(plugin.name, plugin);
  }
  
  async activatePlugin(name: string) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      await plugin.initialize();
      this.activePlugin = plugin;
    }
  }
  
  async detectEmotion(input: any): Promise<EmotionDetectionResult> {
    if (!this.activePlugin) {
      throw new Error('No active emotion detection plugin');
    }
    return this.activePlugin.detectEmotion(input);
  }
}
```

### 2. 配置驱动开发

#### 动态配置系统
```typescript
interface EmotionDetectionConfig {
  // 检测设置
  detectionMode: 'simulation' | 'camera' | 'hybrid';
  detectionInterval: number;
  emotionThreshold: number;
  
  // UI配置
  allowDragging: boolean;
  showDebugInfo: boolean;
  position: { x: number; y: number };
  
  // 算法参数
  timeBasedWeights: boolean;
  emotionWeights: Record<EmotionType, number>;
  
  // 性能设置
  maxFrameRate: number;
  enablePerformanceMonitoring: boolean;
}

// 配置管理
const useEmotionConfig = () => {
  const [config, setConfig] = useState<EmotionDetectionConfig>(DEFAULT_CONFIG);
  
  const updateConfig = (updates: Partial<EmotionDetectionConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };
  
  return { config, updateConfig };
};
```

---

## 📊 测试策略

### 1. 单元测试架构

#### 组件测试
```typescript
// BasicEmotionDetector.test.tsx
describe('BasicEmotionDetector', () => {
  it('should simulate emotion detection based on time', () => {
    const mockTime = new Date('2025-01-20T10:00:00Z'); // 早上10点
    jest.useFakeTimers().setSystemTime(mockTime);
    
    const onEmotionDetected = jest.fn();
    render(
      <BasicEmotionDetector 
        onEmotionDetected={onEmotionDetected}
        isActive={true}
        detectionInterval={1000}
      />
    );
    
    // 验证时间感知算法
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    expect(onEmotionDetected).toHaveBeenCalled();
    // 早上应该有更高的happy概率
    // ... 更多断言
  });
});
```

#### 算法测试
```typescript
// emotionAlgorithm.test.ts
describe('智能情绪算法', () => {
  it('should return appropriate emotion weights for different times', () => {
    // 测试早上权重
    const morningWeights = calculateEmotionWeights(9);
    expect(morningWeights.happy).toBeGreaterThan(0.3);
    
    // 测试晚上权重  
    const eveningWeights = calculateEmotionWeights(22);
    expect(eveningWeights.neutral).toBeGreaterThan(0.5);
  });
  
  it('should select emotions according to weight distribution', () => {
    const weights = { happy: 1.0, neutral: 0, surprised: 0, sad: 0, angry: 0 };
    
    // 多次采样测试
    const results = Array.from({ length: 100 }, () => 
      selectEmotionByWeight(weights)
    );
    
    expect(results.every(emotion => emotion === 'happy')).toBe(true);
  });
});
```

### 2. 集成测试

#### E2E测试流程
```typescript
// emotionDetection.e2e.ts
describe('情绪检测完整流程', () => {
  it('should integrate emotion detection with Live2D character', async () => {
    // 1. 启动应用
    await device.launchApp();
    
    // 2. 导航到主屏幕
    await element(by.text('开始体验')).tap();
    
    // 3. 验证情绪检测器可见
    await expect(element(by.id('emotion-detector'))).toBeVisible();
    
    // 4. 等待情绪检测触发
    await waitFor(element(by.id('emotion-indicator')))
      .toHaveText('😊')
      .withTimeout(5000);
    
    // 5. 验证Live2D角色响应
    await expect(element(by.id('live2d-character')))
      .toHaveAnimationState('Happy');
  });
});
```

---

## 📈 性能优化策略

### 1. 渲染优化

#### React优化
```typescript
// 1. 适当的memo化
const BasicEmotionDetector = React.memo<EmotionDetectorProps>(
  ({ onEmotionDetected, isActive, detectionInterval }) => {
    // ... 组件实现
  },
  (prevProps, nextProps) => {
    // 自定义比较逻辑
    return prevProps.isActive === nextProps.isActive &&
           prevProps.detectionInterval === nextProps.detectionInterval;
  }
);

// 2. useCallback优化
const simulateEmotionDetection = useCallback(() => {
  // 情绪检测逻辑
}, [isActive, detectionInterval, currentEmotion]); // 精确依赖

// 3. useMemo缓存计算
const emotionWeights = useMemo(() => {
  return calculateEmotionWeights(new Date().getHours());
}, [Math.floor(Date.now() / (1000 * 60 * 60))]); // 每小时更新
```

#### 动画优化
```typescript
// 1. 使用runOnUI减少桥接开销
const animatedStyle = useAnimatedStyle(() => {
  'worklet';
  return {
    transform: [
      { scale: scale.value },
      { translateX: position.value.x },
      { translateY: position.value.y }
    ]
  };
}, []);

// 2. 批量更新
const updatePositionAndScale = (newPosition: Position, newScale: number) => {
  'worklet';
  position.value = newPosition;
  scale.value = withSpring(newScale);
};
```

### 2. 内存管理

#### 生命周期优化
```typescript
const BasicEmotionDetector: React.FC<EmotionDetectorProps> = (props) => {
  // 1. 定时器清理
  useEffect(() => {
    const interval = setInterval(simulateEmotionDetection, detectionInterval);
    return () => clearInterval(interval);
  }, [simulateEmotionDetection, detectionInterval]);
  
  // 2. 动画值清理
  useEffect(() => {
    return () => {
      scale.value = 1;
      // 其他清理逻辑
    };
  }, []);
  
  // 3. 事件监听器清理
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);
};
```

---

## 🔒 安全和隐私

### 1. 数据安全

#### 本地处理原则
```typescript
// 所有情绪检测数据本地处理，不上传服务器
const processEmotionData = (emotionData: EmotionDetectionResult) => {
  // 1. 本地存储加密
  const encryptedData = encrypt(emotionData, LOCAL_KEY);
  AsyncStorage.setItem('emotion_cache', encryptedData);
  
  // 2. 内存中临时缓存
  const temporaryCache = new Map<string, EmotionDetectionResult>();
  
  // 3. 定期清理敏感数据
  setTimeout(() => {
    temporaryCache.clear();
  }, CACHE_TIMEOUT);
};
```

#### 权限管理
```typescript
// 摄像头权限最小化原则
const requestCameraPermission = async () => {
  const { status } = await Camera.requestCameraPermissionsAsync();
  
  if (status !== 'granted') {
    // 提供明确的权限说明
    Alert.alert(
      '摄像头权限',
      '情绪检测功能需要访问摄像头来分析面部表情，数据仅在本地处理。',
      [
        { text: '取消', style: 'cancel' },
        { text: '授权', onPress: () => Linking.openSettings() }
      ]
    );
  }
};
```

### 2. 隐私保护

#### 数据匿名化
```typescript
interface AnonymizedEmotionData {
  emotion: EmotionType;
  timestamp: number;
  sessionId: string; // 随机生成，不关联用户
  // 移除所有可识别信息
}

const anonymizeEmotionData = (
  data: EmotionDetectionResult
): AnonymizedEmotionData => ({
  emotion: data.emotion,
  timestamp: Math.floor(data.timestamp / (1000 * 60 * 5)) * (1000 * 60 * 5), // 5分钟精度
  sessionId: generateRandomSessionId()
});
```

---

*文档版本: 1.0.0*  
*最后更新: 2025-01-20*  
*技术栈: React Native 0.79.5 + Expo 53 + TypeScript*
# Video-Chat 项目快速参考指南

## 核心文件速查

### 语音对话系统
- **主文件**: `/EmoMate/src/utils/useChatAI.ts` (410行)
- **配置**: `/EmoMate/src/constants/ai.ts`
- **人格**: `/EmoMate/src/constants/personality.ts`

**关键功能**:
- Claude AI 集成 (Haiku/Sonnet)
- ElevenLabs TTS (语音 ID: hkfHEbBvdQFNX4uWHqRF)
- 主动对话系统 (3 阶段沉默检测)
- 智能对话类型检测

### 表情识别系统
- **面部检测**: `/EmoMate/src/components/BasicEmotionDetector.tsx` (17KB)
- **文本分析**: `/EmoMate/src/utils/emotionAnalysis.ts` (114行)
- **类型定义**: `/EmoMate/src/types/emotion.ts` (33行)

**关键功能**:
- MLKit 1.9.0 人脸检测
- 5种情绪识别 (happy, sad, surprised, angry, neutral)
- 可拖拽浮动窗口 (60fps)
- 关键词+Claude语义混合分析

### Live2D 集成
- **WebView**: `/EmoMate/src/components/HiyoriWebView.tsx` (21KB)
- **Bridge**: `window.HiyoriBridge` (JavaScript)
- **Web 应用**: `/character/app/components/HiyoriLive2D.tsx`

**关键功能**:
- 11种动作 (Idle, Happy, Thinking, Speaking等)
- WebView Bridge 通信
- 心跳系统 (5秒间隔)
- 多阶段初始化

### 状态管理
- **用户状态**: `/EmoMate/src/store/userStore.ts`
- **AI 状态**: `/EmoMate/src/store/useAIStatus.ts`
- **情绪状态**: `/EmoMate/src/components/EmotionProvider.tsx`

**技术**: Zustand 5.0.6 + Immer

---

## 文件大小统计

| 组件 | 大小 | 行数 |
|-----|------|------|
| HiyoriWebView.tsx | 21.4 KB | ~500+ |
| BasicEmotionDetector.tsx | 17.0 KB | ~400+ |
| useChatAI.ts | - | 410 |
| emotionAnalysis.ts | - | 114 |
| faceDetection.ts | - | 177 |
| useSpeechToText.ts | - | 145 |

**EmoMate 总计**: ~6,293行 TypeScript/TSX

---

## API 配置

### Claude API
```javascript
// 位置: EmoMate/src/constants/ai.ts
baseURL: 'https://api.anthropic.com/v1/messages'
models: {
  haiku: 'claude-3-haiku-20240307',
  sonnet: 'claude-3-sonnet-20240229'
}
maxTokens: {
  simple: 80,
  normal: 150,
  detailed: 300,
  storytelling: 500
}
```

### ElevenLabs TTS
```javascript
// 语音 ID: hkfHEbBvdQFNX4uWHqRF (兰兰专用)
// 情绪参数:
// - gentle: stability 0.4, similarity_boost 0.7
// - happy: stability 0.3, similarity_boost 0.65
// - caring: stability 0.6, similarity_boost 0.8
```

### MLKit 人脸检测
```javascript
// 库: react-native-vision-camera-face-detector@1.9.0
performanceMode: 'fast'
classificationMode: 'all'
minFaceSize: 0.15
trackingEnabled: false
```

---

## 开发命令

### EmoMate
```bash
cd EmoMate
npm install
npm start                              # 生产模式
SHOW_TEST_COMPONENTS=true npm start    # 调试模式
npm run android                        # Android
npm run ios                           # iOS
```

### Character
```bash
cd character
npm install
npm run dev                               # 开发
SHOW_TEST_COMPONENTS=true npm run dev     # 调试
npm run build                            # 构建
npm start                               # 生产
```

---

## 关键类型定义

### 情绪类型
```typescript
type EmotionType = 'happy' | 'sad' | 'neutral' | 'angry' | 'surprised';

interface EmotionDetectionResult {
  emotion: EmotionType;
  confidence: number;        // 0-1
  timestamp: number;
}
```

### 消息协议
```typescript
interface BridgeMessage {
  id: string;
  type: 'domReady' | 'modelReady' | 'motionResult' | 'heartbeat' | etc;
  timestamp: number;
  data?: any;
  error?: string;
}
```

### Hiyori 动作
```typescript
type HiyoriMotion = 
  | 'Idle' | 'Happy' | 'Surprised' | 'Shy' | 'Wave' 
  | 'Dance' | 'Laugh' | 'Thinking' | 'Speaking' 
  | 'Excited' | 'Sleepy';
```

---

## 数据流

### 语音对话流程
```
用户输入 → 语音识别 → Claude API → 情绪检测 
→ TTS (ElevenLabs/Expo) → 播放 → Live2D 动作
```

### 情绪检测流程
```
面部检测 (MLKit) → 面部情绪
文本分析 (关键词+Claude) → 文本情绪
                ↓
              组合判断 (优先级: 文本 > 面部 > 中立)
                ↓
              更新 EmotionProvider
                ↓
              驱动 Live2D 角色反应
```

### WebView 通信流程
```
EmoMate 按钮点击 → playMotion() → WebView Bridge 
→ HiyoriBridge.playMotion() → Live2D 动作执行 
→ motionResult 回调 → 更新 UI 状态
```

---

## 环境变量

### Expo Config (app.config.ts)
```javascript
extra: {
  claudeApiKey: process.env.CLAUDE_API_KEY,
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  showTestComponents: process.env.SHOW_TEST_COMPONENTS === 'true'
}
```

### Vite Config (character/vite.config.ts)
```javascript
server: {
  host: '0.0.0.0',     // 所有网络接口
  port: 5174,          // 开发端口
}
```

---

## 调试技巧

### 启用调试模式
```bash
# EmoMate
SHOW_TEST_COMPONENTS=true npm start

# Character
SHOW_TEST_COMPONENTS=true npm run dev
```

### 调试工具
```typescript
// EmoMate
import { debugLog, debugError, isDebugMode } from '../utils/debug';

debugLog('ComponentName', '消息', { data });
```

### 常见问题排查

| 问题 | 原因 | 解决方案 |
|-----|------|--------|
| WebView 连接失败 | 网络配置 | 检查 192.168.31.28:5174 |
| 面部检测不工作 | 需要 Development Build | 使用 EAS Build |
| TTS 无声音 | API 密钥不对 | 检查 ELEVENLABS_API_KEY |
| 主动对话不触发 | 定时器问题 | 查看 useChatAI.ts 第 137-190 行 |

---

## 项目健康指标

| 指标 | 评分 | 优先级 |
|-----|------|--------|
| 功能完整性 | 85% | 中 |
| 代码质量 | 80% | 中 |
| 文档完善度 | 90% | 低 |
| 性能表现 | 75% | 高 |
| 生产就绪度 | 85% | 中 |

---

## 关键改进项

### 高优先级
- [ ] 性能优化 (长时间聊天内存增长)
- [ ] 网络断线重连
- [ ] 测试框架

### 中优先级
- [ ] 多语言支持
- [ ] 更多情绪类型
- [ ] 动作队列管理

### 低优先级
- [ ] API 文档生成
- [ ] 架构图
- [ ] 贡献者指南

---

## 快速开发清单

- [ ] 安装 Development Build: `eas build --profile development`
- [ ] 启动 Character Web 应用
- [ ] 启动 EmoMate 并连接到 WebView
- [ ] 测试语音识别
- [ ] 测试面部情绪检测
- [ ] 测试 Live2D 动作响应

---

## 关键资源

- **完整探索报告**: `/PROJECT_EXPLORATION_REPORT.md`
- **EmoMate 文档**: `/EmoMate/docs/`
- **Character 文档**: `/character/CLAUDE.md`
- **主项目文档**: `/CLAUDE.md`

---

最后更新: 2025-01-21

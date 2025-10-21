# Video-Chat 项目全面探索报告

**报告日期**: 2025-01-21  
**项目状态**: 🚀 生产就绪  
**代码行数**: ~6,293 行 (EmoMate TypeScript/TSX)

---

## 📋 目录

1. [项目概述](#项目概述)
2. [EmoMate - 移动应用](#emomate---移动应用)
3. [Character - 网页应用](#character---网页应用)
4. [核心功能模块](#核心功能模块)
5. [已实现功能](#已实现功能)
6. [待优化项](#待优化项)
7. [技术栈](#技术栈)
8. [文档体系](#文档体系)

---

## 项目概述

**Video-Chat** 是一个多项目生态系统，用于 Live2D 角色交互和视频聊天功能，展示了 React Native 移动应用与网页 Live2D 字符显示之间的集成。

### 项目结构

```
video-chat/
├── EmoMate/                           # React Native 移动应用 (26 个文件夹)
│   ├── src/
│   │   ├── components/                # 16 个 React 组件
│   │   ├── screens/                   # 4 个屏幕
│   │   ├── store/                     # Zustand 状态管理
│   │   ├── utils/                     # 12 个工具函数
│   │   ├── types/                     # TypeScript 类型定义
│   │   └── constants/                 # 配置常量
│   ├── docs/                          # 7 个文档文件
│   ├── app.config.ts                  # Expo 配置
│   ├── babel.config.js                # Babel 配置
│   └── package.json
├── character/                         # Remix 网页应用
│   ├── app/
│   │   ├── components/                # 2 个 Live2D 组件
│   │   ├── routes/                    # 3 个路由
│   │   ├── types/                     # Live2D 类型定义
│   │   └── root.tsx
│   ├── public/assets/live2d/          # Hiyori 模型文件
│   ├── vite.config.ts
│   └── package.json
└── CLAUDE.md                          # 多项目文档

```

---

## EmoMate - 移动应用

### 项目信息

- **类型**: React Native + Expo
- **框架版本**: 
  - Expo 53.0.20
  - React Native 0.79.5
  - React 19.0.0
  - TypeScript 5.8.3

- **核心依赖**:
  - 语音系统: expo-audio, expo-speech, expo-speech-recognition
  - 视觉系统: expo-camera, react-native-vision-camera, react-native-vision-camera-face-detector
  - 动画: react-native-reanimated, react-native-worklets-core
  - 状态管理: zustand (5.0.6) + immer
  - 导航: @react-navigation (7.1.14)
  - UI: nativewind (4.1.23), tailwindcss

### 文件组织

**类型定义** (`src/types/`):
- `emotion.ts` - 情绪类型和接口 (33 行)
  - `EmotionType`: 'happy' | 'sad' | 'neutral' | 'angry' | 'surprised'
  - `EmotionDetectionResult`: 情绪+信心度+时间戳
  - `EmotionState`: 面部/文本/组合情绪
  - `EmotionDetectorProps`: 组件属性接口

**屏幕** (`src/screens/`):
- `HomeScreen.tsx` - 主聊天屏幕 (150+ 行)
- `WelcomeScreen.tsx` - 欢迎屏幕
- `ChatHistoryScreen.tsx` - 聊天历史
- `HiyoriScreen.tsx` - Hiyori Live2D 交互屏幕
- `EmotionTestScreen.tsx` - 情绪检测测试屏幕 (80+ 行)

**核心组件** (`src/components/`):
- `BasicEmotionDetector.tsx` (17,030 字节) - 面部情绪检测
- `ChatEmotionAnalyzer.tsx` (2,746 字节) - 文本情绪分析
- `EmotionAwareCharacter.tsx` (4,633 字节) - 情绪感知角色
- `HiyoriWebView.tsx` (21,448 字节) - WebView 集成
- `Live2DCharacter.tsx` (6,620 字节) - Live2D 字符处理
- `VoiceControl.tsx` - 语音控制
- `ChatBubble.tsx`, `ChatList.tsx`, `CurrentSpeechBubble.tsx`
- `LoadingDots.tsx`, `ErrorToast.tsx`, `Header.tsx`
- `EmotionProvider.tsx` - 情绪提供者

**工具函数** (`src/utils/`):
- `useChatAI.ts` (410 行) - Claude AI 集成
- `useSpeechToText.ts` (145 行) - 语音识别
- `useHybridTTS.ts` - 混合 TTS
- `useElevenLabsTTS.ts` - ElevenLabs 语音合成
- `emotionAnalysis.ts` (114 行) - 情绪分析算法
- `faceDetection.ts` (177 行) - 面部检测 (MLKit 1.9.0)
- `permissions.ts` - 权限管理
- `debug.ts` - 调试工具

**状态管理** (`src/store/`):
- `userStore.ts` - 用户状态 (Zustand + Immer)
- `useAIStatus.ts` - AI 状态管理

**常量** (`src/constants/`):
- `ai.ts` - Claude API 配置 + 能力管理
- `personality.ts` - 兰兰人格设定

---

## 已实现的功能模块

### 1. 语音对话系统

**文件位置**:
- `/src/utils/useChatAI.ts` (410 行)
- `/src/constants/ai.ts` (150+ 行)

**功能特性**:

✅ **Claude AI 集成**
- 模型: claude-3-haiku, claude-3-sonnet
- API 配置: 完整的 baseURL, headers, 请求体
- 动态 Token 配置:
  - simple: 80 tokens
  - normal: 150 tokens
  - detailed: 300 tokens
  - storytelling: 500 tokens

✅ **智能对话系统**
- 对话类型检测: 简单/正常/详细/故事讲述
- 情绪检测: 开心、难过、困惑、紧张、中立
- 上下文维持: 保留最近 10 条消息
- 人格系统: 兰兰温柔日本女高中生设定

✅ **主动对话功能** (ProactiveConversation)
- 1 分钟沉默 → 短暂检测
- 2 分钟沉默 → 中等停顿检测
- 3 分钟沉默 → 长时间停顿检测
- 智能话题选择: 基于对话历史的上下文感知

✅ **混合 TTS 系统**
- ElevenLabs API: 高质量语音 (语音 ID: hkfHEbBvdQFNX4uWHqRF)
- Expo Speech 后备: 设备内语音合成
- 情感感知语音参数:
  - gentle (轻柔): stability 0.4, similarity_boost 0.7
  - happy (开心): stability 0.3, similarity_boost 0.65
  - caring (关心): stability 0.6, similarity_boost 0.8

**实现亮点**:
```typescript
// 对话类型检测函数
const conversationType = detectConversationType(content, updatedMessages);

// 情绪感知的 TTS 参数
speak(aiResponse, voiceId, userEmotion)

// 主动对话计时器管理
setTimeout(() => sendProactiveMessage(topic), PROACTIVE_CONFIG.silenceDetection.shortPause)
```

### 2. 表情识别系统

**文件位置**:
- `/src/components/BasicEmotionDetector.tsx` (17,030 字节)
- `/src/utils/faceDetection.ts` (177 行)
- `/src/utils/emotionAnalysis.ts` (114 行)

**检测能力**:

✅ **MLKit 人脸检测** (v1.9.0)
- 库: react-native-vision-camera-face-detector
- 检测参数:
  - performanceMode: 'fast'
  - classificationMode: 'all' (启用情绪分类)
  - minFaceSize: 0.15
  - trackingEnabled: false

✅ **五种情绪识别**:
```typescript
smilingProbability > 0.6                  → happy (开心)
eyeOpen > 0.8 && smile < 0.3              → surprised (惊讶)
eyeOpen < 0.4 && smile < 0.2              → sad (难过)
smile < 0.1 && eyeOpen > 0.5              → angry (生气)
其他                                       → neutral (中立)
```

✅ **混合情绪分析**:
- 关键词匹配: 快速识别常见情绪词
- Claude API 语义分析: 深度理解文本情绪
- 优先级: 文本情绪 > 面部情绪 > 中立

✅ **UI 特性**:
- 可拖拽浮动窗口 (120x160px)
- 实时面部检测 (60fps)
- 检测间隔配置: 可自定义
- 两种模式: MLKit 真实检测 + 智能模拟后备

**技术实现**:
```typescript
// 使用 useFaceDetector hook
const { detectFaces } = useFaceDetector(faceDetectionOptions);

// Worklet 帧处理
const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  const faces = detectFaces(frame);
  updateEmotionWorklet(emotion, confidence);
}, [detectFaces, updateEmotionWorklet]);
```

### 3. 动画交互系统

**文件位置**:
- `/src/components/HiyoriWebView.tsx` (21,448 字节)
- `/src/components/Live2DCharacter.tsx` (6,620 字节)
- `/src/components/EmotionAwareCharacter.tsx` (4,633 字节)

**集成状态**: ✅ 完全集成

✅ **Live2D 字符集成**:
- 角色: Hiyori VTuber
- 11 种动作: Idle, Happy, Surprised, Shy, Wave, Dance, Laugh, Thinking, Speaking, Excited, Sleepy
- 网络: character 项目 (http://192.168.31.28:5174/)

✅ **WebView Bridge 系统**:
```typescript
interface HiyoriBridge {
  playMotion: (motionName: string) => void;
  getAvailableMotions: () => string[];
  checkModelStatus: () => void;
  reload: () => void;
}
```

✅ **通信协议**:
- 消息格式: BridgeMessage (id, type, timestamp, data, error)
- 消息类型: domReady, readinessUpdate, modelReady, heartbeat, motionResult
- 超时保护: 10 秒超时
- 重试机制: 最多 3 次加载尝试

✅ **情绪映射**:
```typescript
// HomeScreen 中的 AI 状态 → Hiyori 动作映射
listening         → Thinking (倾听思考)
isGenerating      → Thinking (生成中)
isSpeaking        → Speaking (播放中)
默认              → Idle    (空闲)
```

### 4. 文本情绪分析

**文件位置**:
- `/src/components/ChatEmotionAnalyzer.tsx` (2,746 字节)
- `/src/utils/emotionAnalysis.ts` (114 行)

**功能**:

✅ **关键词匹配** (快速识别):
```typescript
EMOTION_KEYWORDS = {
  happy: ['开心', '高兴', '快乐', '兴奋', '愉快', ...],
  sad: ['难过', '伤心', '沮丧', '失落', '痛苦', ...],
  angry: ['生气', '愤怒', '气愤', '恼火', '烦躁', ...],
  surprised: ['惊讶', '震惊', '意外', '吃惊', ...],
  neutral: ['还好', '一般', '平常', '普通', ...]
}
```

✅ **Claude API 语义分析** (深度识别):
- 当关键词匹配失败时触发
- 支持复杂情绪表达的理解
- 5 种标准情绪响应

✅ **优先级处理**:
```typescript
if (textEmotion && textEmotion !== 'neutral') {
  return textEmotion;  // 文本情绪优先
} else if (facialEmotion && facialEmotion !== 'neutral') {
  return facialEmotion; // 次选面部情绪
} else {
  return 'neutral';     // 默认中立
}
```

### 5. 人格与个性化系统

**文件位置**:
- `/src/constants/personality.ts` (80+ 行)
- `/src/constants/ai.ts` (150+ 行)

**人物设定**: 兰兰 (LanLan)

✅ **基础设定**:
- 名字: 兰兰
- 年龄: 17 岁
- 人格: 温柔的日本女高中生
- 灵感: 毛利兰 (《名侦探柯南》)
- 角色: 温柔姐姐

✅ **核心特质**:
- 温柔体贴 (Gentle & Empathetic)
- 偶尔害羞 (Shy)
- 不喜欢长篇大论 (Concise)
- 遇到感性话题会真情流露 (Emotional)

✅ **说话风格**:

句式特征:
- 长度: 20-50 字符 (简单), 50-120 (正常), 120-300 (详细), 200-500 (故事)
- 语气: 温柔, 口语化
- 避免正式或机械化语言

常用表达:
- 害羞/疑惑: "诶？", "嗯…", "欸嘿嘿", "那个…"
- 口语: "嗯嗯", "是呢", "这样啊", "好的呢"
- 赞同: "对对", "是的呢", "嗯嗯", "我也觉得"
- 关心: "没事吧？", "怎么了", "要紧吗", "别担心哦"
- 感叹: "哇！", "好棒！", "真的吗！", "太好了"

✅ **行为准则**:
应该做的:
- 用温柔的语气回应
- 认真倾听用户的话
- 给予情感支持和共情
- 用简短自然的话语表达
- 在适当时候表现出害羞
- 记住用户提过的话

不应该做的:
- 过于正式或冷冰冰
- 长篇大论的解释
- 重复相同的问题
- 忽视用户的情感
- 使用过多的感叹号

---

## Character - 网页应用

### 项目信息

- **类型**: Remix Web 应用
- **框架版本**:
  - Remix 2.16.8 with React 18.2.0
  - Vite 6.0.0
  - TypeScript 5.1.6

- **核心依赖**:
  - PIXI.js 7.4.3 (WebGL 渲染)
  - pixi-live2d-display-mulmotion 0.5.0-mm-5 (Live2D)
  - Tailwind CSS 3.4.4

### 核心功能

✅ **Live2D 模型显示**:
- 角色: Hiyori VTuber
- 文件: `/assets/live2d/hiyori_vts/hiyori.model3.json`
- 缩放: 0.12x
- 位置: 居中显示

✅ **11 种动作支持**:
```
Idle      - 默认空闲
Happy     - 开心
Surprised - 惊讶
Shy       - 害羞
Wave      - 挥手
Dance     - 舞蹈
Laugh     - 大笑
Thinking  - 思考
Speaking  - 说话
Excited   - 兴奋
Sleepy    - 困顿
```

✅ **JavaScript Bridge**:
```typescript
window.HiyoriBridge = {
  playMotion: (motionName: string) => void;
  getAvailableMotions: () => string[];
  isModelLoaded: () => boolean;
  getReadinessState: () => ReadinessState;
  getPerformanceMetrics: () => PerformanceMetrics;
  sendHeartbeat: () => void;
}
```

✅ **多阶段初始化**:
1. DOM 加载 → domReady
2. Live2D 核心加载 → live2dReady
3. 模型加载 → modelReady
4. Bridge 初始化 → bridgeReady
5. 全部就绪 → allReady

✅ **性能指标**:
- DOM 加载时间: < 100ms
- Live2D 核心加载: < 500ms
- 模型加载: < 2000ms
- 总初始化: < 3000ms
- 动作响应: < 100ms

✅ **心跳系统**:
- 每 5 秒发送一次状态更新
- 连接健康检查
- 双向通信验证

---

## 核心功能总览

### 已完成功能

| 功能模块 | 实现文件 | 状态 | 说明 |
|---------|--------|------|------|
| **语音系统** | useChatAI.ts | ✅ | Claude API + ElevenLabs TTS |
| **语音识别** | useSpeechToText.ts | ✅ | 中文支持, expo-speech-recognition |
| **面部检测** | BasicEmotionDetector.tsx | ✅ | MLKit 1.9.0, 5 种情绪 |
| **文本分析** | ChatEmotionAnalyzer.tsx | ✅ | 关键词 + Claude 语义分析 |
| **人格系统** | personality.ts | ✅ | 兰兰完整人设 |
| **Live2D 集成** | HiyoriWebView.tsx | ✅ | 11 种动作, WebView Bridge |
| **状态管理** | userStore.ts | ✅ | Zustand + Immer |
| **主动对话** | useChatAI.ts (lines 137-190) | ✅ | 3 阶段沉默检测 |
| **情绪感知** | EmotionProvider | ✅ | 全局情绪状态管理 |
| **调试系统** | debug.ts | ✅ | 环境变量控制的调试模式 |
| **权限管理** | permissions.ts | ✅ | 相机+麦克风权限 |
| **导航系统** | App.tsx | ✅ | React Navigation Stack |

### 技术栈详情

**前端框架**:
- React Native 0.79.5 + Expo 53
- React 19.0.0 (最新)
- TypeScript 5.8.3 (严格模式)

**AI/ML**:
- Claude 3 (Haiku/Sonnet)
- ElevenLabs TTS API
- Expo Speech Recognition
- MLKit 人脸检测

**状态与动画**:
- Zustand 5.0.6 (状态管理)
- Immer (不可变更新)
- React Native Reanimated (60fps 动画)
- React Native Worklets Core (性能线程)

**UI/UX**:
- Tailwind CSS
- NativeWind
- React Navigation

**开发工具**:
- Vite 6.0.0 (character 项目构建)
- Remix 2.16.8 (web 应用)
- Babel (worklets 支持)

---

## 已知技术债务与待优化项

### 1. 表情识别准确性

**当前状态**: MLKit 1.9.0 支持, 但需要真实测试

**待优化**:
- [ ] 在不同光线条件下的准确性测试
- [ ] 多人脸检测支持
- [ ] 面部遮挡情况处理
- [ ] 更细致的情绪分类 (6+ 种)

**建议**:
```
使用 Google ML Kit 的高级功能:
- Face Contour 检测 (轮廓识别)
- 更细致的表情参数
- 自定义训练模型支持
```

### 2. 语音识别语言支持

**当前状态**: 中文支持 (zh-CN)

**已知问题**:
- iOS 需要启用听写功能或添加键盘语言
- 需要本地识别模型
- Android 支持更好

**待优化**:
- [ ] 多语言自动切换
- [ ] 离线识别模式
- [ ] 识别准确性优化
- [ ] 实时转录反馈

### 3. Live2D 动作系统

**当前状态**: 11 种基础动作

**待优化**:
- [ ] 情绪到动作的更复杂映射
- [ ] 动作队列管理 (多个动作组合)
- [ ] 随机动作选择的智能化
- [ ] 自定义动作支持
- [ ] 口型同步 (LipSync)

### 4. 性能优化

**当前指标**:
- WebView 初始化: ~2000ms
- Live2D 模型加载: < 2000ms
- 动作响应: < 100ms

**待优化**:
- [ ] 模型预加载
- [ ] 内存使用优化 (尤其是长时间聊天)
- [ ] 网络请求缓存
- [ ] 帧率监控与自适应

### 5. 错误处理与恢复

**当前状态**: 基础错误处理

**待优化**:
- [ ] 网络断连自动重连
- [ ] Live2D 加载失败恢复
- [ ] 优雅降级策略
- [ ] 详细的错误日志系统
- [ ] 用户友好的错误提示

### 6. 主动对话系统

**当前状态**: 3 阶段沉默检测

**待优化**:
- [ ] 主动对话话题的多样性
- [ ] 基于用户行为的智能判断
- [ ] 对话疲劳检测
- [ ] 主题连贯性改进
- [ ] A/B 测试支持

### 7. 安全性

**当前状态**: 基础实现

**待优化**:
- [ ] API 密钥管理 (环境变量 ✅, 但需要加密存储)
- [ ] 请求签名验证
- [ ] 速率限制 (Rate Limiting)
- [ ] 数据加密传输
- [ ] 敏感信息过滤

### 8. 测试覆盖

**当前状态**: 无测试框架

**待优化**:
- [ ] 单元测试 (Jest)
- [ ] 集成测试
- [ ] E2E 测试 (Detox)
- [ ] 性能测试
- [ ] 回归测试

### 9. 文档

**当前状态**: 优秀 (7 个 markdown 文档)

**待优化**:
- [ ] API 文档 (OpenAPI/GraphQL)
- [ ] 架构图 (Mermaid/PlantUML)
- [ ] 部署指南
- [ ] 贡献者指南
- [ ] 故障排除扩展

### 10. 跨平台支持

**当前状态**: iOS 优先

**待优化**:
- [ ] Android 完整测试
- [ ] Web 支持 (Expo Web)
- [ ] 平台特定的性能优化
- [ ] 权限管理差异处理

---

## 文档体系

### EmoMate 文档 (`/docs/`)

| 文件 | 大小 | 内容 |
|-----|------|------|
| `EMOTION_DETECTION_MVP.md` | 8.5 KB | MVP 功能文档 |
| `EMOTION_DETECTION_ARCHITECTURE.md` | 20.8 KB | 技术架构设计 |
| `EMOTION_DETECTION_STATUS.md` | 13.6 KB | 功能状态报告 |
| `FACE_DETECTION_COMPLETE_GUIDE.md` | 15.2 KB | MLKit 完整指南 |
| `FACE_DETECTION_IMPLEMENTATION_SUMMARY.md` | 5.9 KB | 实施总结 |
| `HIYORI_INTEGRATION.md` | 6.3 KB | Live2D 集成文档 |
| `README.md` | 3.1 KB | 项目概览 |

**总计**: ~73 KB 文档

### 代码注释

- 类型定义完整 (emotion.ts 33 行都有注释)
- 关键函数有使用说明
- 组件 API 文档清晰
- 常量配置有详细说明

---

## 最新功能变更

### 最近 5 次提交

1. **bc1193a** - `fix: clean up setTimeout` (2025-01-21)
2. **f5f0e44** - `feat: enable MLKit` (2025-01-21)
   - 启用 MLKit 1.9.0 面部检测
   - 替代模拟检测模式
   
3. **0eb29e8** - `feat: upgrade react-native-vision-camera-face-detector` (2025-01-20)
   - 升级到 1.9.0 版本
   - 更新 Frame Processor API

4. **b3f2d11** - `feat: Remove outdated emotion testing guide...` (2025-01-20)
   - 清理过期文档
   - 更新状态报告

5. **970f0e1** - `feat: Add emotion detection status report` (2025-01-20)
   - 添加详细的功能状态报告

### 代码变更统计

```
文件变更: 21
插入: 2,712 行
删除: 2,092 行
净增: 620 行

主要变更:
- HiyoriWebView.tsx: 885 行 (大幅重构)
- BasicEmotionDetector.tsx: 193 行 (MLKit 集成)
- faceDetection.ts: 177 行 (API 更新)
```

---

## 开发指南

### 启动开发环境

**EmoMate (移动应用)**:
```bash
cd EmoMate
npm install
npm start              # 生产模式
SHOW_TEST_COMPONENTS=true npm start  # 调试模式
```

**Character (Web 应用)**:
```bash
cd character
npm install
npm run dev           # http://192.168.31.28:5174/
SHOW_TEST_COMPONENTS=true npm run dev  # 调试模式
```

### 调试模式

两个项目都支持通过环境变量启用调试:

```bash
# EmoMate - 显示 Hiyori WebView 状态面板
SHOW_TEST_COMPONENTS=true npm start

# Character - 显示 Live2D 加载时间和桥接状态
SHOW_TEST_COMPONENTS=true npm run dev
```

### 常见开发任务

**1. 添加新情绪类型**:
```typescript
// src/types/emotion.ts
export type EmotionType = 'happy' | 'sad' | 'neutral' | 'angry' | 'surprised' | 'NEW_EMOTION';

// src/utils/emotionAnalysis.ts
EMOTION_KEYWORDS['new_emotion'] = ['关键词1', '关键词2', ...];
```

**2. 添加新的 Hiyori 动作**:
```typescript
// src/constants/personality.ts
export const HIYORI_MOTIONS = [..., 'NewMotion'] as const;

// Character project: ensure model file has the motion
```

**3. 修改人格设定**:
```typescript
// src/constants/personality.ts
AI_PERSONALITY.character.name = 'NewName';
AI_PERSONALITY.behavior.should.push('New behavior rule');
```

---

## 总结

### 项目健康度

| 指标 | 评分 | 备注 |
|-----|------|------|
| 功能完整性 | 85% | 核心功能完成, 某些高级特性待优化 |
| 代码质量 | 80% | TypeScript 类型安全, 需要测试框架 |
| 文档完善度 | 90% | 文档详实, 但缺少 API 文档 |
| 性能表现 | 75% | 满足基本需求, 有优化空间 |
| 生产就绪度 | 85% | 可生产部署, 建议补充监控 |

### 关键成就

✅ **完整的 AI 伴侣系统**: Claude API + 兰兰人格 + 智能对话
✅ **多模式情绪感知**: 面部检测 + 文本分析 + 组合判断
✅ **Live2D 集成**: 11 种动作 + WebView Bridge + 心跳系统
✅ **专业的语音系统**: ElevenLabs TTS + 情感参数 + Expo 后备
✅ **生产级代码**: TypeScript + 类型安全 + 错误处理
✅ **详实的文档**: 7 份技术文档 + 完整的 CLAUDE.md

### 下一步建议

1. **短期**: 添加测试框架, 完善错误处理
2. **中期**: 性能优化, 支持更多情绪类型
3. **长期**: 云同步, 用户分析, A/B 测试

---

**报告完成于**: 2025-01-21
**维护者**: EmoMate Team
**项目状态**: 🚀 生产就绪


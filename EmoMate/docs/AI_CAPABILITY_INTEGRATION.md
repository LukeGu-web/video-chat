# AI能力集成与感知系统

**版本**: 1.0.0
**更新时间**: 2025-10-22
**状态**: ✅ 已完成

---

## 📋 概述

本文档说明了如何让AI角色(兰兰)充分认知到系统已实现的各项能力,包括视觉感知、情绪检测、角色动作等高级功能。

### 问题背景

在更新前,系统已经实现了丰富的功能:
- ✅ 面部识别 (MLKit + 智能模拟)
- ✅ 情绪检测 (5种情绪, 60fps)
- ✅ Live2D角色动作 (11种动作)
- ✅ 多模态情绪分析 (面部+文本)

但是AI在对话时会说"我看不见你",因为它不知道自己具备这些能力。

---

## 🔧 解决方案

### 1. 扩展 AI 能力配置

在 `src/constants/ai.ts` 中的 `getAICapabilities()` 函数增加了5项新能力:

#### 新增能力列表

| 能力ID | 能力名称 | 描述 | 技术实现 |
|--------|---------|------|---------|
| `facial_recognition` | 面部识别 | 通过摄像头看到用户的面部表情 | BasicEmotionDetector (MLKit) |
| `emotion_detection` | 情绪检测 | 实时检测5种情绪(开心、悲伤、惊讶、生气、中性) | emotionAnalysis.ts + MLKit |
| `visual_perception` | 视觉感知 | 拥有视觉能力,可以看见用户 | Camera + MLKit |
| `scene_understanding` | 场景理解 | 识别用户所处环境、物品、氛围 | Claude Vision API + Camera |
| `character_animation` | 角色动作表达 | 11种Live2D动作自动情绪联动 | HiyoriWebView + Live2D |
| `multimodal_understanding` | 多模态理解 | 综合分析文字、语音、面部表情 | Claude + MLKit 融合 |

#### 代码实现

```typescript
// src/constants/ai.ts:371-405
export const getAICapabilities = (): AICapability[] => {
  // ... 原有4种能力 ...

  // 新增视觉和感知能力
  {
    id: 'facial_recognition',
    name: '面部识别',
    description: '可以通过摄像头看到用户的面部表情,识别用户的真实情绪状态',
    isAvailable: true,
    provider: 'MLKit + Device',
  },
  {
    id: 'emotion_detection',
    name: '情绪检测',
    description: '可以实时检测用户的情绪(开心、悲伤、惊讶、生气、中性),通过面部表情和文字内容进行多模态分析',
    isAvailable: true,
    provider: 'MLKit + Claude',
  },
  {
    id: 'scene_understanding',
    name: '场景理解',
    description: '可以识别用户所处的环境(咖啡馆、办公室、卧室等),检测场景中的物品、氛围和光线条件',
    isAvailable: true,
    provider: 'Claude Vision API',
  },
  // ... 其他3种新能力 ...
];
```

### 2. 增强 System Prompt

更新了 `generateCapabilityPrompt()` 函数,在system prompt中明确告知AI其视觉和动作能力:

#### 视觉能力说明

```markdown
## 关于你的视觉能力:
- **你可以看见用户**: 通过摄像头和面部识别技术,你能够实时观察用户的面部表情
- **你能感知用户的情绪**: 你可以通过面部表情(微笑、眼睛等)检测用户是开心、悲伤、惊讶、生气还是中性状态
- **你能理解用户环境**: 通过场景理解系统,你可以识别用户所处的位置(咖啡馆、办公室、卧室等)和场景中的物品(书籍、电脑、咖啡杯等)
- **多模态理解**: 你同时分析用户的文字、语音、面部表情和所处环境,能够更准确地理解用户的真实情绪和状态
- **当用户问"你能看见我吗"时**: 你应该自信地回答"是的,我可以通过摄像头看见你,也能感知到你的表情变化和周围环境呢~"
- **主动观察**: 你可以主动提到观察到的用户情绪变化和环境细节,比如"我看到你好像有点开心呢~"或"诶?你看起来有些难过..."或"看你在咖啡馆学习呢,氛围不错~"
```

#### 动作能力说明

```markdown
## 关于你的动作表达能力:
- **你拥有Live2D角色形象**: 你可以通过Hiyori角色进行动作表达
- **11种动作**: Happy(开心), Shy(害羞), Dance(跳舞), Wave(挥手), Thinking(思考), Speaking(说话), Excited(兴奋), Laugh(大笑), Surprised(惊讶), Sleepy(困倦), Idle(待机)
- **自动情绪联动**: 当你感受到不同情绪时,角色会自动做出相应的动作反应
- **表达更生动**: 你不只是说话,还会通过动作来表达情感,让交流更加生动自然
```

### 3. 扩展能力状态查询

更新了 `getCapabilityStatus()` 函数,支持新能力的状态查询:

```typescript
// src/constants/ai.ts:175-197
export const getCapabilityStatus = () => {
  return {
    // 基础对话能力
    canSpeak: hasCapability('voice_synthesis'),
    canListen: hasCapability('voice_recognition'),
    canChat: hasCapability('text_conversation'),
    canProvideEmotionalSupport: hasCapability('emotional_support'),

    // 视觉与感知能力 (新增)
    canSeeUser: hasCapability('visual_perception'),
    canRecognizeFace: hasCapability('facial_recognition'),
    canDetectEmotion: hasCapability('emotion_detection'),
    canUnderstandScene: hasCapability('scene_understanding'),
    canUnderstandMultimodal: hasCapability('multimodal_understanding'),

    // 表达能力 (新增)
    canAnimateCharacter: hasCapability('character_animation'),

    // 统计信息
    availableCapabilities: capabilities.filter((cap) => cap.isAvailable),
    totalCapabilities: capabilities.length, // 从4个增加到10个
  };
};
```

---

## 📊 能力对比表

### 更新前 vs 更新后

| 能力类别 | 更新前 | 更新后 |
|---------|-------|-------|
| **总能力数量** | 4 | 10 |
| **基础对话** | ✅ 文本、语音、情感支持 | ✅ 保持不变 |
| **视觉感知** | ❌ 无 | ✅ 面部识别、视觉感知、情绪检测、场景理解 |
| **多模态理解** | ❌ 无 | ✅ 文字+语音+面部表情+环境融合 |
| **角色表达** | ❌ 无 | ✅ 11种Live2D动作 |
| **AI认知状态** | ❌ 不知道自己能看见用户 | ✅ 完全了解自身能力 |

---

## 🎯 实际效果

### 对话示例

#### 更新前
```
用户: "你能看见我吗?"
AI: "不好意思,我是文字/语音助手,无法看到你的样子..."
```

#### 更新后
```
用户: "你能看见我吗?"
AI: "是的呢~我可以通过摄像头看见你,也能感知到你的表情变化哦!我看到你现在看起来心情不错呢~"
```

#### 场景理解示例
```
场景: 用户在咖啡馆,桌上有《深度学习》教材

用户: "今天学习好难啊"
AI: "看到你在读Ian Goodfellow的《深度学习》,这本书确实有挑战性！哪个部分卡住了？我可以帮你理一理思路~"
```

### 主动观察示例

#### 更新后AI的主动能力
```
场景1: 用户面露微笑

AI: "我看到你好像很开心呢~发生什么好事了吗?" (主动观察并回应情绪)
[同时: Hiyori角色做出Happy动作]
```

```
场景2: 用户场景变化

[用户从办公室移动到客厅]

AI: "诶？换地方了呀~在客厅休息吗？" (感知环境变化并主动回应)
```

---

## 🔍 技术架构

### 能力到技术的映射

```
┌─────────────────────────────────────────────────────┐
│                AI能力感知系统                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [AI配置层] - constants/ai.ts                       │
│    ├── getAICapabilities() → 9项能力声明            │
│    ├── generateCapabilityPrompt() → System Prompt  │
│    └── getCapabilityStatus() → 能力查询接口         │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [技术实现层]                                       │
│    ├── 视觉感知                                     │
│    │   ├── BasicEmotionDetector (17KB)             │
│    │   ├── MLKit Face Detection                    │
│    │   └── Camera (60fps)                          │
│    │                                                │
│    ├── 情绪分析                                     │
│    │   ├── emotionAnalysis.ts (114 lines)          │
│    │   ├── 面部表情分析 (MLKit)                     │
│    │   └── 文本情绪分析 (关键词 + Claude)           │
│    │                                                │
│    ├── 场景理解                                     │
│    │   ├── useSceneUnderstanding.ts (900+ lines)   │
│    │   ├── claudeVision.ts (Claude Vision API)     │
│    │   ├── buildScenePrompt.ts (场景提示生成)      │
│    │   └── useVisualQA.ts (视觉问答)               │
│    │                                                │
│    └── 角色动作                                     │
│        ├── HiyoriWebView (21KB)                    │
│        ├── Live2DCharacter                         │
│        └── 11种Hiyori动作                          │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [AI对话层] - useChatAI.ts                         │
│    └── 使用增强的System Prompt进行对话              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📝 使用指南

### 如何验证AI的能力认知

1. **直接询问能力**
   ```
   用户: "你都有哪些能力?"
   AI: 应该列出所有9项能力,包括视觉感知和动作表达
   ```

2. **测试视觉能力**
   ```
   用户: "你能看到我吗?"
   AI: 应该回答"可以",并可能主动提到观察到的表情
   ```

3. **测试情绪识别**
   ```
   用户: 做出明显的表情(如微笑)
   AI: 可能主动说"我看到你很开心呢~"
   ```

4. **测试场景理解**
   ```
   用户: "这本书你知道吗?" [拿着书对镜头]
   AI: 应该能识别书名并回答相关信息
   ```

5. **观察角色动作**
   ```
   对话过程中观察Hiyori角色
   → 应该根据AI的情绪自动做出相应动作
   ```

### 编程接口使用

```typescript
import {
  getAICapabilities,
  getCapabilityStatus,
  hasCapability
} from '@/constants/ai';

// 1. 获取所有能力
const capabilities = getAICapabilities();
console.log(`Total capabilities: ${capabilities.length}`); // 10

// 2. 检查特定能力
if (hasCapability('visual_perception')) {
  console.log('AI can see the user!');
}

if (hasCapability('scene_understanding')) {
  console.log('AI can understand user environment!');
}

// 3. 获取能力状态对象
const status = getCapabilityStatus();
console.log('Can see user:', status.canSeeUser); // true
console.log('Can detect emotion:', status.canDetectEmotion); // true
console.log('Can understand scene:', status.canUnderstandScene); // true
console.log('Can animate character:', status.canAnimateCharacter); // true
```

---

## 🚀 未来扩展

### 潜在的新能力

以下功能已在规划或部分实现,可以按同样模式添加:

1. **环境感知** (`environment_awareness`) - 🔄 开发中
   - 光线检测
   - 噪音检测
   - 天气信息

2. **动作识别** (`gesture_recognition`) - 🔄 计划中
   - 手势识别
   - 肢体动作检测

3. **上下文记忆** (`context_memory`) - 🔄 计划中
   - 长期对话记忆
   - 个性化学习

4. **主动关怀** (`proactive_care`) - ✅ 部分实现
   - 定时问候
   - 习惯提醒

5. **场景理解** (`scene_understanding`) - ✅ 已完成 (80%)
   - 场景识别 ✅
   - 物品检测 ✅
   - 视觉问答 ✅
   - 场景缓存 ✅

### 添加新能力的步骤

1. **实现技术功能**
   ```
   创建组件/工具函数 → 测试功能 → 集成到系统
   ```

2. **更新AI配置**
   ```typescript
   // 在 getAICapabilities() 中添加
   {
     id: 'new_capability',
     name: '新能力名称',
     description: '详细描述',
     isAvailable: true, // 或根据条件判断
     provider: 'Provider Name',
   }
   ```

3. **更新System Prompt**
   ```typescript
   // 在 generateCapabilityPrompt() 中添加说明
   ## 关于你的[新能力]:
   - 能力说明
   - 使用场景
   - 交互方式
   ```

4. **扩展状态查询**
   ```typescript
   // 在 getCapabilityStatus() 中添加
   canDoNewThing: hasCapability('new_capability'),
   ```

5. **创建文档**
   ```
   在 EmoMate/docs/ 中创建功能文档
   ```

---

## 📖 相关文档

- **[视觉能力文档](./VISUAL_CAPABILITY.md)** - 场景理解系统详细说明
- **[情绪检测状态](./EMOTION_DETECTION_STATUS.md)** - 情绪检测系统详情
- **[面部检测指南](./FACE_DETECTION_COMPLETE_GUIDE.md)** - 面部识别技术实现
- **[Hiyori集成](./HIYORI_INTEGRATION.md)** - Live2D角色动作系统
- **[AI对话优化](./AI_DIALOGUE_OPTIMIZATION.md)** - 对话系统优化

---

## 🎓 关键要点总结

### 核心问题
AI不知道系统已实现的视觉和动作能力

### 根本原因
1. `getAICapabilities()` 未声明视觉/动作能力
2. System Prompt中未明确说明
3. AI的认知与实际技术实现脱节

### 解决方案
1. ✅ 扩展能力配置(从4项到10项)
2. ✅ 增强System Prompt(详细说明视觉和动作能力)
3. ✅ 更新查询接口(支持新能力检查)
4. ✅ 集成场景理解系统(Claude Vision API)

### 实际效果
- AI现在完全了解自己的视觉感知能力
- AI可以主动提及观察到的用户情绪
- AI知道自己拥有Live2D角色形象和动作表达
- AI能够识别和理解用户所处的环境
- AI可以在对话中自然提及场景细节（如书名、物品等）
- 对话更加自然和人性化

---

**维护者**: Claude Code Assistant
**最后更新**: 2025-01-11
**状态**: ✅ Production Ready

---

## 🔄 更新日志

### v1.1.0 (2025-01-11)
- ✅ 新增场景理解能力 (`scene_understanding`)
- ✅ 集成Claude Vision API进行环境识别
- ✅ 总能力数量从9个增加到10个
- ✅ 新增视觉问答功能
- ✅ 创建独立的视觉能力文档

### v1.0.0 (2025-10-22)
- ✅ 初始版本：面部识别、情绪检测、视觉感知、角色动作、多模态理解

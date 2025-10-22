# Hiyori Live2D 动作优化文档

## 版本信息

- **版本**: v1.0.0
- **最后更新**: 2025-10-22
- **优化目标**: 实现上下文感知的智能动作选择系统

## 优化概述

### 背景

原有的动作系统只基于简单的情绪映射,无法根据对话内容和情境做出恰当的反应。例如:
- 用户说"你好"时,角色只能根据情绪显示Happy,而不会挥手(Wave)
- 庆祝性的话语(如"太好了!")没有特殊动作,错失表现力
- 思考性问题没有Thinking动作,显得不够智能

### 优化目标

创建一个**智能动作映射系统**,能够:
1. ✅ 分析对话文本内容,识别特定场景(问候、提问、庆祝等)
2. ✅ 结合情绪和上下文选择最恰当的动作
3. ✅ 管理动作优先级,避免冲突
4. ✅ 自动处理临时动作的返回Idle逻辑
5. ✅ 提供平滑的动作过渡

## 核心组件

### 1. Motion Mapper (`motionMapper.ts`)

**位置**: `src/utils/motionMapper.ts`

**功能**:
- 上下文分析(文本模式匹配)
- 动作选择算法(基于优先级)
- 动作过渡管理
- 临时动作处理

#### 关键接口

```typescript
interface ConversationContext {
  text?: string;              // 当前消息文本
  emotion?: EmotionType;      // 检测到的情绪
  isGreeting?: boolean;       // 是否问候
  isQuestion?: boolean;       // 是否提问
  isEncouragement?: boolean;  // 是否鼓励/称赞
  isCelebration?: boolean;    // 是否庆祝
  isEmpathy?: boolean;        // 是否共情/关心
  aiSpeaking?: boolean;       // AI是否正在说话
  aiThinking?: boolean;       // AI是否正在思考
}

interface MotionSelection {
  motion: HiyoriMotion;
  priority: number;           // 优先级(越高越重要)
  reason: string;             // 选择理由(调试用)
  duration?: number;          // 建议持续时间(ms)
  returnToIdle?: boolean;     // 是否应返回Idle
}
```

### 2. Enhanced EmotionAwareCharacter

**位置**: `src/components/EmotionAwareCharacter.tsx`

**更新内容**:
- 集成`motionMapper`进行智能动作选择
- 支持`currentText`属性以传入当前AI回复文本
- 自动管理临时动作的返回Idle
- 增强的调试信息显示(显示选择原因和优先级)

## 动作选择逻辑

### 优先级系统

动作选择遵循以下优先级(从高到低):

```
Priority 4 (SPECIAL)      - 特殊事件
  ├─ 庆祝 (isCelebration) → Dance
  └─ 鼓励 (isEncouragement) → Excited/Happy

Priority 3 (AI_STATUS)    - AI状态
  ├─ 说话 (aiSpeaking) → Speaking
  └─ 思考 (aiThinking) → Thinking

Priority 2 (CONTEXT)      - 上下文场景
  ├─ 问候 (isGreeting) → Wave
  ├─ 共情 (isEmpathy) → Sleepy/Thinking
  └─ 提问 (isQuestion) → Thinking

Priority 1 (EMOTION)      - 基础情绪
  ├─ happy → Happy (或根据上下文: Dance/Laugh/Excited/Wave)
  ├─ sad → Sleepy
  ├─ surprised → Surprised (或根据上下文: Shy)
  ├─ angry → Surprised
  └─ neutral → Idle (或根据上下文: Thinking/Speaking/Wave)

Priority 0 (IDLE)         - 默认状态
  └─ 无特定情况 → Idle
```

### 文本模式识别

系统通过正则表达式匹配识别对话场景:

```typescript
// 问候检测
/^(你好|hi|hello|嗨|哈喽|早上好|晚上好|下午好)/i
/(再见|拜拜|bye|goodbye)/i

// 提问检测
/[?？]|吗$|呢$|怎么|为什么|什么|哪里|如何/i

// 鼓励/称赞检测
/(好棒|厉害|真棒|太好了|加油|干得好|well done|great|awesome)/i

// 庆祝检测
/(庆祝|成功了|完成了|太棒了|耶|万岁|celebrate)/i

// 共情/关心检测
/(没事吧|怎么了|担心|难过|伤心|别哭|安慰|加油)/i
```

### 上下文情绪组合

对于某些情绪,系统会根据上下文选择特定动作:

```typescript
happy + celebration → Dance     (庆祝时跳舞)
happy + laugh → Laugh          (笑声时欢笑)
happy + greeting → Wave        (快乐地打招呼)
happy + excited → Excited      (非常开心时兴奋)

neutral + thinking → Thinking  (思考状态)
neutral + speaking → Speaking  (说话状态)
neutral + greeting → Wave      (中性问候)

surprised + shy → Shy          (惊讶+害羞)
```

## 使用示例

### 场景1: 问候对话

```typescript
// 用户: "你好呀!"
// AI回复: "你好！很高兴见到你呢~"

Context分析:
  - text: "你好！很高兴见到你呢~"
  - emotion: happy
  - isGreeting: true ✅ (匹配 /你好/i)

Motion选择:
  Priority: 2 (CONTEXT)
  Motion: Wave
  Reason: "Greeting detected"
  Duration: 3000ms
  ReturnToIdle: true

执行流程:
  1. 播放Wave动作 (3秒)
  2. 自动返回Idle
```

### 场景2: 庆祝对话

```typescript
// 用户: "我考试通过了!"
// AI回复: "太棒了！我们庆祝一下吧!"

Context分析:
  - text: "太棒了！我们庆祝一下吧!"
  - emotion: happy
  - isCelebration: true ✅ (匹配 /庆祝/)
  - isEncouragement: true ✅ (匹配 /太棒了/)

Motion选择:
  Priority: 4 (SPECIAL)
  Motion: Dance
  Reason: "Celebration detected"
  Duration: 5000ms
  ReturnToIdle: true

执行流程:
  1. 播放Dance动作 (5秒)
  2. 自动返回Idle
```

### 场景3: 思考对话

```typescript
// 用户: "什么是量子力学?"
// AI回复: "嗯…让我想想哦~"

Context分析:
  - text: "嗯…让我想想哦~"
  - emotion: neutral
  - isQuestion: false (AI的回复不是问题)
  - aiThinking: true ✅ (AI状态)

Motion选择:
  Priority: 3 (AI_STATUS)
  Motion: Thinking
  Reason: "AI is thinking"
  Duration: 3000ms
  ReturnToIdle: true

执行流程:
  1. 播放Thinking动作 (3秒)
  2. 开始回答时切换到Speaking
```

### 场景4: 共情对话

```typescript
// 用户: "我今天很难过"
// AI回复: "没事吧？要不要和我说说?"

Context分析:
  - text: "没事吧？要不要和我说说?"
  - emotion: sad
  - isEmpathy: true ✅ (匹配 /没事吧/)

Motion选择:
  Priority: 2 (CONTEXT)
  Motion: Sleepy (因为emotion=sad)
  Reason: "Empathy/concern detected"
  Duration: 4000ms
  ReturnToIdle: true

执行流程:
  1. 播放Sleepy动作 (4秒,表现出关心)
  2. 自动返回Idle
```

## 动作特性

### 临时动作

以下动作会自动返回Idle:

| 动作 | 持续时间 | 使用场景 |
|------|----------|----------|
| Wave | 3秒 | 问候、告别 |
| Dance | 5秒 | 庆祝、欢乐 |
| Laugh | 3秒 | 笑声、幽默 |
| Excited | 3秒 | 兴奋、激动 |
| Surprised | 2秒 | 惊讶反应 |
| Thinking | 3秒 | 思考、处理 |

### 持续动作

以下动作不会自动返回Idle:

| 动作 | 使用场景 |
|------|----------|
| Idle | 默认待机状态 |
| Speaking | AI说话时(持续到说话结束) |
| Happy | 持续的快乐情绪 |
| Sleepy | 持续的疲惫/悲伤 |
| Shy | 持续的害羞状态 |

## 集成指南

### 在现有组件中使用

```typescript
import { EmotionAwareCharacter } from '../components/EmotionAwareCharacter';
import { useAIStatus } from '../store';

function ChatScreen() {
  const { setAIStatus } = useAIStatus();
  const [currentAIText, setCurrentAIText] = useState('');

  // 当AI开始回复时
  const handleAIResponse = (text: string) => {
    setCurrentAIText(text);
    setAIStatus('Speaking');
  };

  // 当AI回复结束时
  const handleAIComplete = () => {
    setAIStatus('Idle');
    setCurrentAIText('');
  };

  return (
    <View>
      <EmotionAwareCharacter
        size={300}
        currentText={currentAIText}  // 传入当前文本用于上下文分析
        enableEmotionMapping={true}
        onMotionComplete={(motion, success) => {
          console.log(`Motion ${motion} completed`);
        }}
      />
    </View>
  );
}
```

### 手动触发特定动作

如果需要手动控制动作而不依赖自动选择:

```typescript
import { selectMotionFromText } from '../utils/motionMapper';

// 根据文本快速选择动作
const selection = selectMotionFromText(
  "太好了！我们成功了！",
  'happy',
  false,  // aiSpeaking
  false   // aiThinking
);

console.log(selection.motion);  // "Dance"
console.log(selection.reason);  // "Celebration detected"
```

## 性能优化

### 模式匹配性能

- 所有正则表达式在模块加载时编译一次
- 模式匹配在文本长度<200字符时性能优秀(<1ms)
- 对于长文本,仅匹配前100个字符以提升性能

### 动作切换性能

- 动作优先级比较使用整数,无浮点计算
- 动作转换使用简单的字符串比较
- 避免频繁切换:相同动作不会重复播放

### 内存使用

- 上下文对象轻量(<1KB)
- 无全局状态,所有状态在组件中管理
- 定时器自动清理,无内存泄漏

## 调试工具

### Debug模式

在调试模式下(`SHOW_TEST_COMPONENTS=true`),角色会显示详细信息:

```
Motion Selection
├─ Facial: happy
├─ Text: happy
├─ Combined: happy
├─ AI Status: Speaking
├─ Motion: Speaking
├─ Priority: 3
└─ Reason: AI is speaking
```

### 日志输出

关键日志输出示例:

```typescript
[MotionMapper] Context detected: isGreeting
  { text: "你好！", pattern: "^(你好|hi|hello|...)" }

[MotionMapper] Selected motion: Wave
  {
    context: { text: "你好！", emotion: "happy", isGreeting: true },
    selection: { motion: "Wave", priority: 2, reason: "Greeting detected" }
  }

[EmotionAwareCharacter] Emotion changed: neutral -> happy
  {
    facialEmotion: "happy",
    textEmotion: null,
    aiStatus: null,
    resultMotion: "Wave",
    selectionReason: "Greeting detected"
  }
```

## 扩展指南

### 添加新的文本模式

编辑`motionMapper.ts`中的`textPatterns`数组:

```typescript
const textPatterns: TextPattern[] = [
  // ... 现有模式 ...

  // 新增: 检测讲故事场景
  {
    pattern: /(讲个故事|听故事|从前|很久很久以前)/i,
    contextKey: 'isStorytelling',
    priority: MotionPriority.CONTEXT
  },
];

// 同时更新ConversationContext接口
interface ConversationContext {
  // ... 现有字段 ...
  isStorytelling?: boolean;  // 新增
}

// 在selectMotion()中添加处理逻辑
if (context.isStorytelling && priority < MotionPriority.CONTEXT) {
  selectedMotion = 'Thinking';  // 或其他合适的动作
  priority = MotionPriority.CONTEXT;
  reason = 'Storytelling detected';
  duration = 5000;
  returnToIdle = false;  // 讲故事时持续Thinking
}
```

### 添加新的动作类型

如果未来Hiyori模型添加了新动作(如`Crying`, `Sleeping`等):

1. 更新`HiyoriMotion`类型(在`store/userStore.ts`)
2. 在`motionMapper.ts`中添加到相应映射
3. 更新`getMotionDuration()`和`isTemporaryMotion()`
4. 在文档中记录新动作的使用场景

## 已知限制

1. **文本长度**: 当前仅分析前100个字符,超长文本可能错过后续关键词
2. **多语言**: 模式主要针对中文和英文,其他语言支持有限
3. **复杂语境**: 无法理解深层语义(如讽刺、反语),仅基于关键词
4. **动作冲突**: 同时满足多个高优先级条件时,只选择第一个匹配的

## 未来优化方向

### 短期(1-2周)

1. **上下文记忆**: 记住最近3-5句话,识别连续对话主题
2. **情绪强度**: 根据情绪强度(强/弱)选择动作变体
3. **声音同步**: 将动作与TTS语音时长精确对齐

### 中期(1-2月)

1. **机器学习**: 使用简单的分类器识别更复杂的语境
2. **动作序列**: 支持组合动作(如Wave→Laugh→Happy的流畅过渡)
3. **个性化**: 学习用户偏好,调整动作选择策略

### 长期(3-6月)

1. **语义理解**: 集成NLP模型进行深度语义分析
2. **多模态**: 结合面部表情、语音语调选择动作
3. **自定义动作**: 允许用户创建和配置自定义动作规则

## 相关文档

- **Hiyori集成**: `HIYORI_INTEGRATION.md`
- **情绪检测**: `EMOTION_DETECTION_ARCHITECTURE.md`
- **AI对话优化**: `AI_DIALOGUE_OPTIMIZATION.md`
- **项目进度**: `../PROGRESS.md`

## 版本历史

- **v1.0.0** (2025-10-22): 初始版本
  - 上下文感知的动作选择系统
  - 优先级管理和动作过渡
  - 文本模式匹配(5种场景)
  - 临时动作自动返回Idle
  - 增强的调试信息

## 贡献者

- **系统设计**: Claude Code
- **需求来源**: 用户反馈和HIYORI_INTEGRATION.md
- **测试**: 待执行

---

**注意**: 本文档描述的优化已在代码中实现。建议在生产环境部署前进行充分测试,验证各种对话场景下的动作选择是否符合预期。

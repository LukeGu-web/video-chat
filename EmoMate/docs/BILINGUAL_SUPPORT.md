# 双语支持功能文档 (Bilingual Support)

**版本**: v1.0.0
**状态**: ✅ 生产就绪
**最后更新**: 2025-01-01
**作者**: Claude Code

---

## 📋 目录

1. [功能概述](#功能概述)
2. [设计原则](#设计原则)
3. [架构设计](#架构设计)
4. [已修改文件清单](#已修改文件清单)
5. [核心工作流程](#核心工作流程)
6. [使用指南](#使用指南)
7. [技术细节](#技术细节)
8. [故障排除](#故障排除)
9. [未来扩展](#未来扩展)

---

## 功能概述

EmoMate 现已支持**中英文双语对话**，能够自动检测用户输入的语言并智能切换回复语言。

### 核心特性

✅ **自动语言检测**：根据用户输入自动识别中文或英文
✅ **持久化语言状态**：检测到语言后保持，直到用户主动切换
✅ **命令双语支持**：中英文关键词都能触发视觉识别功能
✅ **全系统同步**：AI对话、小话、物品识别、场景提示全部跟随语言
✅ **零 i18n 框架**：轻量级实现，无额外依赖
✅ **UI 保持中文**：用户界面不受影响，仅对话系统支持双语

### 语言检测规则

```typescript
// 检测逻辑
有中文字符 → 中文 (zh)
纯英文字符 → 英文 (en)

// 示例
"Hello" → en
"你好" → zh
"hello 你好" → zh (混合输入默认中文)
"look at this" → en
```

---

## 设计原则

### 1. 用户体验优先

- **智能检测**：无需手动切换语言，系统自动识别
- **持久化状态**：避免频繁切换，保持对话连贯性
- **渐进增强**：不影响现有中文用户体验

### 2. 轻量级实现

- **无 i18n 框架**：避免引入 react-i18next 等重型库
- **最小改动**：仅扩展现有代码，不重构架构
- **向后兼容**：所有函数保持默认参数 `language: 'zh' | 'en' = 'zh'`

### 3. 系统一致性

- **全局同步**：所有辅助系统（小话、物品识别、场景提示）自动跟随语言
- **统一接口**：所有双语函数使用相同的 `language` 参数
- **中央管理**：语言状态由 `userStore` 统一管理

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户输入                              │
│                     "Hello" / "你好"                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  语言检测层           │
          │ languageDetection.ts │
          │  detectLanguage()    │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  状态管理层           │
          │   userStore.ts       │
          │ currentLanguage: zh/en│
          └──────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌────────────────┐      ┌────────────────┐
│  命令识别层     │      │   AI对话层      │
│ sceneKeywords  │      │  useChatAI.ts  │
│ - 中文关键词    │      │ - 动态Prompt    │
│ - 英文关键词    │      │ - 语言指示      │
└────────┬───────┘      └────────┬───────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┬───────────┐
         ▼                       ▼           ▼
┌─────────────┐        ┌─────────────┐  ┌─────────────┐
│ 小话系统     │        │ 物品识别     │  │ 场景提示     │
│ smallTalk   │        │ announcer   │  │ scenePrompt │
│ - 中文小话   │        │ - 中文模板   │  │ - 中文标签   │
│ - 英文小话   │        │ - 英文模板   │  │ - 英文标签   │
└─────────────┘        └─────────────┘  └─────────────┘
```

### 数据流

```
User Input (用户输入)
    ↓
Language Detection (语言检测)
    ↓
Update State (更新状态: currentLanguage)
    ↓
Generate Language-Aware Prompt (生成语言化提示词)
    ↓
Call Claude API (调用AI)
    ↓
AI Response in Detected Language (AI用对应语言回复)
```

---

## 已修改文件清单

### 核心文件（8个）

| 文件路径 | 修改内容 | 行数变化 |
|---------|---------|---------|
| **src/utils/languageDetection.ts** | 新建语言检测工具 | +60 |
| **src/store/userStore.ts** | 添加语言状态管理 | +10 |
| **src/capabilities/vision/environment/sceneKeywords.ts** | 扩展中英文命令关键词 | +40 |
| **src/constants/ai.ts** | 动态语言提示词生成 | +30 |
| **src/utils/smallTalk.ts** | 双语小话库 | +60 |
| **src/utils/objectRecognitionAnnouncer.ts** | 双语识别宣布模板 | +80 |
| **src/capabilities/vision/environment/buildScenePrompt.ts** | 双语场景提示 | +120 |
| **src/hooks/useChatAI.ts** | 集成语言检测逻辑 | +15 |

### 辅助文件（2个）

| 文件路径 | 修改内容 |
|---------|---------|
| **src/hooks/ai/buildAIContext.ts** | 添加 `language` 参数到上下文构建函数 |

### 总计

- **新增代码**: ~415 行
- **修改文件**: 9 个
- **新增文件**: 1 个

---

## 核心工作流程

### 1. 用户发送消息流程

```typescript
// Step 1: 用户输入
User: "Hello"

// Step 2: 语言检测 (useChatAI.ts:330-336)
const detectedLanguage = detectLanguage(content);
// → 'en'

// Step 3: 更新语言状态
useUserStore.getState().setCurrentLanguage(detectedLanguage);

// Step 4: 生成语言化的 Personality (useChatAI.ts:155)
const languageAwarePersonality = createPersonalitySystemPrompt(currentLanguage);

// Step 5: 构建 API 请求 (buildAIContext.ts)
const apiConfig = buildCacheableAPIRequestConfig(
  messages,
  config,
  conversationType,
  languageAwarePersonality,
  currentScene,
  true,
  currentLanguage // 传递当前语言
);

// Step 6: 调用 Claude API
// 系统提示词包含：
// "【Language Mode: English】
//  The user is communicating in English. Please respond ENTIRELY in English."

// Step 7: AI 回复
AI: "Hi~ How are you doing today?"
```

### 2. 视觉命令识别流程

```typescript
// 中文命令
User: "这是什么"
    ↓
detectObjectKeywords("这是什么")
    ↓ 匹配成功
    ↓
小话: "让我看一看~" (语言: zh)
    ↓
识别结果: "这是杯子~" (语言: zh)
    ↓
AI: "这是杯子~你在喝咖啡吗？" (语言: zh)

// 英文命令
User: "what is this"
    ↓
detectObjectKeywords("what is this")
    ↓ 匹配成功
    ↓
小话: "Let me see~" (语言: en)
    ↓
识别结果: "This is a cup~" (语言: en)
    ↓
AI: "Oh, this is a cup~ Are you having some coffee?" (语言: en)
```

### 3. 语言切换流程

```typescript
// 场景：用户从英文切换到中文
Current State: currentLanguage = 'en'

User: "你好"
    ↓
detectLanguage("你好") → 'zh'
    ↓
setCurrentLanguage('zh')
    ↓
State Updated: currentLanguage = 'zh'
    ↓
后续对话全部使用中文
```

---

## 使用指南

### 开发者使用

#### 1. 添加新的双语文本

如果需要在新的地方添加双语支持：

```typescript
// ❌ 错误：硬编码中文
function myFunction() {
  return "这是一个提示";
}

// ✅ 正确：支持双语
function myFunction(language: 'zh' | 'en' = 'zh') {
  return language === 'en'
    ? "This is a prompt"
    : "这是一个提示";
}
```

#### 2. 获取当前语言状态

```typescript
import { useUserStore } from '../store/userStore';

// 在 React 组件中
const currentLanguage = useUserStore((state) => state.currentLanguage);

// 在非 React 代码中
const currentLanguage = useUserStore.getState().currentLanguage;
```

#### 3. 调用双语函数

所有双语函数都遵循相同模式：

```typescript
// 获取当前语言
const language = useUserStore.getState().currentLanguage;

// 调用双语函数
const announcement = generateObjectAnnouncement(objectData, style, language);
const scenePrompt = buildScenePrompt(sceneData, true, 5, language);
const smallTalk = selectSmallTalk(tier, language);
```

### 用户使用

用户无需任何设置，系统自动检测：

1. **英文对话**：直接说英文，AI 会自动切换到英文回复
   ```
   User: "Hello"
   AI: "Hi~ How are you doing today?"
   ```

2. **中文对话**：说中文，AI 保持中文
   ```
   用户: "你好"
   AI: "你好呀~"
   ```

3. **切换语言**：随时可以切换
   ```
   User: "Hello"
   AI: "Hi~ How are you?"
   User: "你好" ← 切回中文
   AI: "你好呀~"
   ```

4. **视觉命令**：中英文都能触发
   ```
   中文: "看这个" "这是什么" "识别这个"
   英文: "look at this" "what is this" "identify this"
   ```

---

## 技术细节

### 1. 语言检测算法

**文件**: `src/utils/languageDetection.ts`

```typescript
export function detectLanguage(text: string): SupportedLanguage {
  if (!text || text.trim().length === 0) {
    return 'zh'; // 默认中文
  }

  // 中文字符范围
  const chinesePattern = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/;
  const hasChinese = chinesePattern.test(text);

  return hasChinese ? 'zh' : 'en';
}
```

**Unicode 范围**：
- `\u4e00-\u9fa5`: CJK 统一汉字（常用中文字符）
- `\u3000-\u303f`: CJK 符号和标点
- `\uff00-\uffef`: 全角和半角字符（包括中文标点）

### 2. 命令关键词系统

**文件**: `src/capabilities/vision/environment/sceneKeywords.ts`

#### 中文关键词（物品识别）

```typescript
const chineseObjectPhrases = [
  '看这个东西',      // 长短语优先
  '帮我看看这个',
  '帮我看看这',
  '看这个',
  '看看这个',
  '看看这',
  '识别这个',
  '识别这',
  '这是什么东西',
  '这个是什么',
  '这是什么',       // 常用问句
  '这什么',
  '这东西',
  '那是什么',
  '那个是什么',
];
```

#### 英文关键词（物品识别）

```typescript
const englishObjectPhrases = [
  'what is this',
  "what's this",
  'what is that',
  "what's that",
  'identify this',
  'identify that',
  'recognize this',
  'recognize that',
  'look at this',
  'look at that',
  'this is',
  'that is',
];
```

#### 检测逻辑

```typescript
// 中文：简单包含检测
if (trimmedText.includes(phrase)) {
  return phrase;
}

// 英文：小写化后检测
if (lowerText.includes(phrase)) {
  return phrase;
}
```

### 3. AI 系统提示词动态化

**文件**: `src/constants/ai.ts`

```typescript
export const createPersonalitySystemPrompt = (
  currentLanguage: 'zh' | 'en' = 'zh'
): string => {
  let prompt = `# 角色设定
你是${character.name}，${character.age}岁的${character.personality}...
[中文人格设定]`;

  // 如果是英文模式，添加语言指示
  if (currentLanguage === 'en') {
    prompt += `

---

# 🌍 Language Mode: English

**IMPORTANT**: The user is communicating in English.
Please respond ENTIRELY in English.

## English Response Guidelines:
- Maintain your gentle and caring personality
- Use natural English expressions and conversational tone
- Keep the same concise style (1-3 sentences typically)
- Ignore the Chinese-specific expressions mentioned above
- Express cuteness and shyness naturally in English (e.g., "Um...", "Ehe~", "Well...")

## Examples in English:
- Simple greeting: "Hi there~"
- Caring response: "Are you okay? What happened..."
- Happy response: "That's great! I'm so happy for you~"
- Shy response: "Um... well... ehe~"

**Remember**: Respond naturally in English while maintaining Lan Lan's gentle personality.`;
  }

  return prompt;
};
```

### 4. 小话系统双语化

**文件**: `src/utils/smallTalk.ts`

```typescript
const SMALL_TALK_DATABASE: Record<
  'zh' | 'en',
  Record<SmallTalkTier, SmallTalkPhrase[]>
> = {
  zh: {
    [SmallTalkTier.SHORT]: [
      { text: '让我看一看~', tier: SmallTalkTier.SHORT, estimatedDuration: 1500 },
      { text: '嗯...', tier: SmallTalkTier.SHORT, estimatedDuration: 1000 },
      { text: '诶？', tier: SmallTalkTier.SHORT, estimatedDuration: 800 },
    ],
    // ... MEDIUM, LONG
  },
  en: {
    [SmallTalkTier.SHORT]: [
      { text: 'Let me see~', tier: SmallTalkTier.SHORT, estimatedDuration: 1500 },
      { text: 'Um...', tier: SmallTalkTier.SHORT, estimatedDuration: 1000 },
      { text: 'Oh?', tier: SmallTalkTier.SHORT, estimatedDuration: 800 },
    ],
    // ... MEDIUM, LONG
  },
};
```

### 5. 物品识别宣布模板

**文件**: `src/utils/objectRecognitionAnnouncer.ts`

```typescript
function generateSimpleAnnouncement(
  object: ObjectRecognitionData,
  language: 'zh' | 'en' = 'zh'
): string {
  const templates = language === 'en'
    ? [
        `This is ${object.objectName}~`,
        `This is a ${object.objectName}~`,
        `Oh, it's ${object.objectName}~`,
        `I see a ${object.objectName}~`,
      ]
    : [
        `这是${object.objectName}~`,
        `这个是${object.objectName}呢~`,
        `嗯，这是${object.objectName}~`,
        `我看到的是${object.objectName}~`,
      ];

  return templates[Math.floor(Math.random() * templates.length)];
}
```

### 6. 场景提示生成

**文件**: `src/capabilities/vision/environment/buildScenePrompt.ts`

```typescript
export function buildScenePrompt(
  sceneData: SceneData | null,
  includeDetails: boolean = true,
  maxObjects: number = 5,
  language: 'zh' | 'en' = 'zh'
): string {
  // 示例：位置标签
  parts.push(
    language === 'en'
      ? `\n\n【User's Visual Environment】`
      : `\n\n【用户视觉环境】`
  );

  // 示例：对象列表
  parts.push(
    language === 'en'
      ? `\nNearby objects: ${topObjects}`
      : `\n周围物品: ${topObjects}`
  );
}
```

---

## 故障排除

### 问题 1: 命令不能触发识别

**症状**: 说"这是什么"没有触发物品识别

**原因**: 关键词不在物品识别列表中

**解决方案**:
1. 检查 `sceneKeywords.ts` 中的 `chineseObjectPhrases` 列表
2. 确保关键词已添加：`'这是什么'`
3. 查看控制台日志，确认关键词检测

**调试日志**:
```
[SceneKeywords] 🎯 Object keyword detected: "这是什么" in "这是什么"
```

### 问题 2: AI 不切换语言

**症状**: 说英文但 AI 仍用中文回复

**原因**: 语言检测失败或状态未更新

**检查步骤**:
1. 确认输入是纯英文（无中文字符）
2. 查看调试日志：
   ```
   [ChatAI] Language detected { content: "Hello", detectedLanguage: "en" }
   ```
3. 检查 `userStore.currentLanguage` 状态

**解决方案**:
```typescript
// 手动设置语言（调试用）
import { useUserStore } from './store/userStore';
useUserStore.getState().setCurrentLanguage('en');
```

### 问题 3: 混合输入行为不符合预期

**症状**: "hello 你好" 被识别为英文

**原因**: 这是预期行为（有中文就用中文）

**说明**:
```typescript
detectLanguage("hello 你好") // → 'zh'
detectLanguage("hello")      // → 'en'
```

### 问题 4: 英文小话不播放

**症状**: 英文命令触发识别，但小话仍是中文

**原因**: `SmallTalkManager` 未传递 `language` 参数

**检查位置**: `useAIConversationFlow.ts:172`

```typescript
// ✅ 正确
const currentLanguage = useUserStore.getState().currentLanguage;
const manager = createRecognitionSmallTalkManager(
  async (text: string) => { ... },
  () => { ... },
  currentLanguage // 传递语言参数
);
```

### 问题 5: 场景提示仍是中文

**原因**: `buildScenePrompt` 未传递 `language` 参数

**检查位置**: `buildAIContext.ts:94, 175`

```typescript
// ✅ 正确
const scenePrompt = buildScenePrompt(sceneToUse, true, 5, language);
```

---

## 未来扩展

### 短期优化（1-2周）

1. **更多英文命令词**
   - 添加更多自然表达：`"check this out"`, `"tell me about this"`
   - 支持缩写：`"what's up"`, `"that's"`

2. **优化英文表达**
   - 收集 AI 回复样本，优化英文 personality
   - 添加更多英文可爱表达示例

3. **性能优化**
   - 缓存语言检测结果
   - 减少重复的正则匹配

### 中期扩展（1-2月）

1. **日语支持**
   - 添加 `'ja'` 语言类型
   - 日文关键词库
   - 日文人格设定

2. **语言混合模式**
   - 允许在一次对话中使用多种语言
   - 更智能的语言检测（基于句子而非整段）

3. **手动语言切换**
   - 添加 UI 语言切换按钮（可选）
   - 语音命令切换：`"切换到英文"` / `"switch to English"`

### 长期愿景（3-6月）

1. **完整国际化**
   - 引入 i18n 框架
   - UI 界面多语言
   - 错误消息多语言

2. **方言支持**
   - 粤语、闽南语等中文方言
   - 区域性英文（美式、英式）

3. **语言学习模式**
   - 双语对照显示
   - 发音纠正
   - 词汇学习

---

## 附录

### A. 完整文件列表

```
EmoMate/
├── src/
│   ├── utils/
│   │   └── languageDetection.ts          # 语言检测工具 ✨ 新增
│   ├── store/
│   │   └── userStore.ts                  # 用户状态管理 ✏️ 修改
│   ├── capabilities/vision/environment/
│   │   ├── sceneKeywords.ts              # 命令关键词 ✏️ 修改
│   │   └── buildScenePrompt.ts           # 场景提示生成 ✏️ 修改
│   ├── constants/
│   │   └── ai.ts                         # AI 配置 ✏️ 修改
│   ├── utils/
│   │   ├── smallTalk.ts                  # 小话系统 ✏️ 修改
│   │   └── objectRecognitionAnnouncer.ts # 识别宣布 ✏️ 修改
│   ├── hooks/
│   │   ├── useChatAI.ts                  # 对话系统 ✏️ 修改
│   │   └── ai/
│   │       └── buildAIContext.ts         # 上下文构建 ✏️ 修改
│   └── ...
└── docs/
    └── BILINGUAL_SUPPORT.md              # 本文档 ✨ 新增
```

### B. 关键代码片段

#### 语言检测

```typescript
import { detectLanguage } from '../utils/languageDetection';

const language = detectLanguage(userInput);
// 'zh' 或 'en'
```

#### 获取/设置语言状态

```typescript
import { useUserStore } from '../store/userStore';

// 获取
const currentLanguage = useUserStore.getState().currentLanguage;

// 设置
useUserStore.getState().setCurrentLanguage('en');
```

#### 调用双语函数

```typescript
// 获取当前语言
const lang = useUserStore.getState().currentLanguage;

// AI 提示词
const personality = createPersonalitySystemPrompt(lang);

// 场景提示
const scenePrompt = buildScenePrompt(sceneData, true, 5, lang);

// 物品识别宣布
const announcement = generateObjectAnnouncement(objectData, style, lang);

// 小话
const smallTalk = selectSmallTalk(tier, lang);
```

### C. 测试用例

```typescript
// 语言检测测试
describe('detectLanguage', () => {
  test('纯英文', () => {
    expect(detectLanguage('Hello')).toBe('en');
    expect(detectLanguage('what is this')).toBe('en');
  });

  test('纯中文', () => {
    expect(detectLanguage('你好')).toBe('zh');
    expect(detectLanguage('这是什么')).toBe('zh');
  });

  test('混合输入', () => {
    expect(detectLanguage('hello 你好')).toBe('zh');
    expect(detectLanguage('你好 world')).toBe('zh');
  });

  test('空输入', () => {
    expect(detectLanguage('')).toBe('zh'); // 默认中文
  });
});

// 命令识别测试
describe('detectObjectKeywords', () => {
  test('中文关键词', () => {
    expect(detectObjectKeywords('这是什么')).toBe('这是什么');
    expect(detectObjectKeywords('看这个')).toBe('看这个');
  });

  test('英文关键词', () => {
    expect(detectObjectKeywords('what is this')).toBe('what is this');
    expect(detectObjectKeywords('look at this')).toBe('look at this');
  });

  test('非关键词', () => {
    expect(detectObjectKeywords('hello world')).toBeNull();
  });
});
```

---

## 总结

✅ **双语支持已完全实施并生产就绪**

- **9 个文件**已修改，**~415 行**新增代码
- **中英文对话**智能切换，用户体验流畅
- **命令识别**双语支持，视觉功能完整
- **零依赖**轻量级实现，性能优秀
- **向后兼容**，不影响现有功能

### 维护建议

1. **添加新文本时**：始终考虑双语支持
2. **测试新功能时**：用中英文都测试一遍
3. **代码审查时**：检查是否传递了 `language` 参数
4. **性能监控**：关注语言检测的性能开销

### 联系与反馈

如有问题或建议，请参考：
- **故障排除**章节
- **技术细节**章节
- 提交 Issue 或 PR

---

**文档版本**: v1.0.0
**生成时间**: 2025-01-01
**下次审查**: 2025-02-01

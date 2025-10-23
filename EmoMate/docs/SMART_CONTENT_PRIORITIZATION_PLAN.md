# 智能内容优先级系统 - 实施计划

**项目名称**: Smart Content Prioritization System (SCPS)
**版本**: 1.0.0
**创建日期**: 2025-10-22
**状态**: 📋 计划中 → 准备实施
**预计完成时间**: 2-3小时

---

## 📋 项目概述

### 目标
实现AI回复的智能内容优先级系统,在保持流式响应流畅度的前提下,确保:
1. ✅ 句子完整性 (不被截断)
2. ✅ 重点内容优先 (核心信息先说)
3. ✅ 智能精简 (次要信息自动过滤)
4. ✅ 流畅体验 (不影响实时性)

### 核心问题
**当前痛点**: AI有时会说很多补充信息,导致回复冗长,或者最后一句话被截断

**示例**:
```
用户问: "你吃了什么午饭"

当前AI可能回答:
"我吃了寿司~是三文鱼口味的,还有味增汤和小菜,味道很不错呢..."
(太啰嗦,可能被截断)

期望AI回答:
"吃了寿司~" (简短完整)
或
"吃了寿司~是三文鱼的" (有补充价值时)
```

### 技术方案
**方案1 + 方案3 + 方案4 组合**:
- 方案1: 后置智能精简 (安全截断)
- 方案3: 混合流式 + 智能过滤 (实时判断)
- 方案4: Claude提示词优化 (源头控制)

---

## 🎯 技术架构设计

### 三层防护机制

```
Layer 1: AI生成层 (System Prompt优化)
  ↓ Claude按重要性排序生成内容
  ↓ 第1句=核心答案, 第2句=补充, 第3句=禁止

Layer 2: 流式处理层 (SmartSentenceBuffer)
  ↓ 第1句: 立即播放 ✅
  ↓ 第2句: 判断重要性 → 播放/跳过
  ↓ 第3句+: 自动跳过 ❌

Layer 3: 后置验证层 (validateStreamResponse)
  ↓ 确保不超过字符限制
  ↓ 保证句子完整性
  ↓ 最终输出 → TTS播放
```

### 数据流图

```
用户输入 "你吃了什么午饭"
    ↓
Claude API (streaming)
    ↓
Chunk 1: "吃了"
Chunk 2: "寿司~"  ← 检测到完整句子
    ↓
SmartSentenceBuffer
    ├─ 第1句 "吃了寿司~"
    │   └─ 重要性: 1.0 (核心答案)
    │   └─ 决策: ✅ 立即播放
    │
Chunk 3: "是三文鱼"
Chunk 4: "的~"  ← 检测到完整句子
    ↓
SmartSentenceBuffer
    ├─ 第2句 "是三文鱼的~"
    │   └─ 重要性: 0.7 (有价值补充)
    │   └─ 当前总长度: 11字 < 50字
    │   └─ 决策: ✅ 播放
    │
Chunk 5: "还有味增"
Chunk 6: "汤~"  ← 检测到完整句子
    ↓
SmartSentenceBuffer
    ├─ 第3句 "还有味增汤~"
    │   └─ 重要性: 0.4 (次要信息)
    │   └─ 包含"还"字 (补充标志)
    │   └─ 决策: ❌ 跳过播放
    │
最终播放: "吃了寿司~是三文鱼的~"
```

---

## 📊 实施阶段规划

### Phase 1: System Prompt优化 (方案4)
**目标**: 让AI在生成时就按重要性排序
**预计时间**: 20分钟
**优先级**: 🔴 最高

#### 任务清单
- [ ] **Task 1.1**: 更新 `createPersonalitySystemPrompt()`
  - 位置: `src/constants/ai.ts:35-147`
  - 添加"回答优先级策略"章节
  - 定义第1句/第2句/第3句的规则
  - 提供正确/错误示例对比

- [ ] **Task 1.2**: 增强"智能回应要求"
  - 位置: `src/constants/ai.ts:126-153`
  - 每种对话类型明确重要性排序
  - 添加"重点优先"示例

- [ ] **Task 1.3**: 更新情绪响应提示
  - 位置: `src/constants/ai.ts:473-503`
  - 在情绪提示中强调简洁性

#### 验收标准
- ✅ System Prompt包含明确的优先级策略
- ✅ 有清晰的✅/❌示例对比
- ✅ 每种对话类型都有指导

---

### Phase 2: SmartSentenceBuffer实现 (方案3)
**目标**: 智能判断句子重要性,过滤次要内容
**预计时间**: 45分钟
**优先级**: 🔴 最高

#### 任务清单
- [ ] **Task 2.1**: 创建 `SmartSentenceBuffer` 类
  - 位置: `src/utils/smartSentenceBuffer.ts` (新建)
  - 实现句子检测和缓冲
  - 实现重要性评分算法
  - 实现智能过滤逻辑

- [ ] **Task 2.2**: 实现重要性评分算法
  - 规则1: 第1句固定满分 (1.0)
  - 规则2: 包含核心信息词 (+0.2)
  - 规则3: 长度过长 (-0.3)
  - 规则4: 包含补充连接词 (-0.2)
  - 规则5: 总长度限制判断

- [ ] **Task 2.3**: 实现类型定义
  - 位置: `src/types/smartBuffer.d.ts` (新建)
  - 定义接口和类型

#### 核心代码结构
```typescript
// src/utils/smartSentenceBuffer.ts

export class SmartSentenceBuffer {
  private sentences: string[] = [];
  private totalLength: number = 0;
  private sentenceCount: number = 0;
  private conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling';

  constructor(conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling') {
    this.conversationType = conversationType;
  }

  // 添加chunk并检测完整句子
  addChunk(chunk: string): string[] {
    // 检测完整句子
    const newSentences = this.detectSentences(chunk);
    const toPlay: string[] = [];

    for (const sentence of newSentences) {
      if (this.shouldPlay(sentence)) {
        toPlay.push(sentence);
        this.sentences.push(sentence);
        this.totalLength += sentence.length;
        this.sentenceCount++;
      } else {
        console.log('[SmartBuffer] 跳过次要句子:', sentence);
      }
    }

    return toPlay;
  }

  // 判断是否应该播放
  private shouldPlay(sentence: string): boolean {
    // 第1句: 必须播放
    if (this.sentenceCount === 0) return true;

    // 计算重要性分数
    const importance = this.calculateImportance(sentence);

    // 检查长度限制
    const lengthConfig = this.getLengthLimit();
    const wouldExceed = this.totalLength + sentence.length > lengthConfig;

    // 决策逻辑
    if (wouldExceed) return false; // 超长直接拒绝
    if (this.sentenceCount >= 2) return false; // 最多2句
    if (importance < 0.6) return false; // 重要性不足

    return true;
  }

  // 计算句子重要性 (0-1分数)
  private calculateImportance(sentence: string): number {
    let score = 0.5; // 基础分

    // 规则1: 核心信息词 (+0.2)
    const coreKeywords = ['是', '有', '在', '会', '能', '可以', '吃了', '做了'];
    if (coreKeywords.some(kw => sentence.includes(kw))) {
      score += 0.2;
    }

    // 规则2: 句子过长 (-0.3)
    if (sentence.length > 25) {
      score -= 0.3;
    }

    // 规则3: 补充连接词 (-0.2)
    const supplementWords = ['然后', '还', '另外', '此外', '而且', '以及', '同时'];
    if (supplementWords.some(w => sentence.includes(w))) {
      score -= 0.2;
    }

    // 规则4: 例举词 (-0.25)
    const enumerationWords = ['比如', '例如', '包括', '像'];
    if (enumerationWords.some(w => sentence.includes(w))) {
      score -= 0.25;
    }

    return Math.max(0, Math.min(1, score));
  }

  // 获取当前对话类型的长度限制
  private getLengthLimit(): number {
    switch (this.conversationType) {
      case 'simple': return 50;
      case 'normal': return 80;
      case 'detailed': return 150;
      case 'storytelling': return 250;
      default: return 80;
    }
  }

  // 检测完整句子
  private detectSentences(chunk: string): string[] {
    // 实现句子边界检测逻辑
    // ...
  }
}
```

#### 验收标准
- ✅ `SmartSentenceBuffer` 类实现完整
- ✅ 重要性评分算法合理
- ✅ 第1句必定播放
- ✅ 第2句智能判断
- ✅ 第3句及以后自动跳过
- ✅ 有详细的日志输出

---

### Phase 3: 集成到流式系统 (方案3)
**目标**: 将SmartSentenceBuffer集成到现有的useChatAI
**预计时间**: 30分钟
**优先级**: 🟡 高

#### 任务清单
- [ ] **Task 3.1**: 在 `useChatAI.ts` 中集成
  - 位置: `src/utils/useChatAI.ts`
  - 替换现有的 `SentenceBuffer`
  - 使用 `SmartSentenceBuffer`

- [ ] **Task 3.2**: 更新流式处理逻辑
  - 传递 `conversationType` 参数
  - 处理返回的待播放句子
  - 保持TTS队列逻辑不变

- [ ] **Task 3.3**: 添加调试日志
  - 记录每个句子的决策过程
  - 输出跳过的句子内容
  - 便于后续调优

#### 集成示例代码
```typescript
// src/utils/useChatAI.ts (修改部分)

const sendMessage = async (content: string, config?: ChatAIConfig) => {
  // 检测对话类型
  const conversationType = detectConversationType(content, messages);

  // 创建智能句子缓冲器
  const smartBuffer = new SmartSentenceBuffer(conversationType);
  const ttsQueue = new TTSQueue();

  // 流式处理
  for await (const chunk of streamResponse) {
    const text = parseSSEChunk(chunk);

    // 智能过滤 - 只返回需要播放的句子
    const sentencesToPlay = smartBuffer.addChunk(text);

    // 添加到TTS队列
    for (const sentence of sentencesToPlay) {
      await ttsQueue.enqueue(sentence);
    }
  }
};
```

#### 验收标准
- ✅ 不破坏现有流式逻辑
- ✅ TTS队列正常工作
- ✅ 句子顺序正确
- ✅ 调试日志清晰

---

### Phase 4: 后置验证优化 (方案1)
**目标**: 确保最终输出的完整性和安全性
**预计时间**: 15分钟
**优先级**: 🟢 中

#### 任务清单
- [ ] **Task 4.1**: 优化 `validateAndOptimizeResponse()`
  - 位置: `src/constants/ai.ts:506-546`
  - 调整截断逻辑,优先保留完整句子
  - 改进标点符号检测

- [ ] **Task 4.2**: 添加完整性检查
  - 检测最后一句是否完整
  - 如果不完整,回退到上一个完整句子

#### 优化代码
```typescript
// src/constants/ai.ts

export const validateAndOptimizeResponse = (
  response: string,
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal'
): string => {
  const lengthConfig = getResponseLengthConfig(conversationType);
  let optimized = response.trim();

  // 移除多余换行
  optimized = optimized.replace(/\n+/g, ' ');

  // 如果在限制内,直接返回
  if (optimized.length <= lengthConfig.maxCharacters) {
    return optimized;
  }

  // 超长时,按句子截断而不是字符截断
  const sentences = optimized.match(/[^。！？~…]+[。！？~…]/g) || [];

  if (sentences.length === 0) {
    // 没有完整句子,按字符截断但加省略号
    return optimized.substring(0, lengthConfig.maxCharacters - 1) + '~';
  }

  // 尽可能多地保留完整句子
  let result = '';
  for (const sentence of sentences) {
    if (result.length + sentence.length <= lengthConfig.maxCharacters) {
      result += sentence;
    } else {
      break; // 超长就停止
    }
  }

  // 确保至少有第1句
  if (result.length === 0 && sentences.length > 0) {
    result = sentences[0];
  }

  return result || optimized.substring(0, lengthConfig.maxCharacters - 1) + '~';
};
```

#### 验收标准
- ✅ 优先保留完整句子
- ✅ 不会在句子中间截断
- ✅ 至少保留第1句
- ✅ 超长时有优雅降级

---

### Phase 5: 测试与调优
**目标**: 全面测试系统,调整参数
**预计时间**: 30分钟
**优先级**: 🟡 高

#### 测试用例

##### 测试用例1: 简单问答
```
输入: "你好"
期望: "你好呀~" (1句,简短完整)
```

##### 测试用例2: 有补充价值
```
输入: "你吃了什么午饭"
期望: "吃了寿司~是三文鱼的" (2句,有价值补充)
```

##### 测试用例3: 过滤次要信息
```
输入: "你吃了什么午饭"
AI生成: "吃了寿司~是三文鱼的~还有味增汤~以及小菜"
期望播放: "吃了寿司~是三文鱼的~" (过滤"还有"和"以及")
```

##### 测试用例4: 详细讲解
```
输入: "给我讲讲寿司的做法"
期望: 2-3句完整讲解 (因为用户明确要求详细)
```

##### 测试用例5: 流式响应流畅度
```
测试: 边生成边播放是否流畅
期望: 第1句立即播放,第2句及时播放
```

#### 调优参数

| 参数 | 初始值 | 说明 | 可调范围 |
|------|-------|------|---------|
| 重要性阈值 | 0.6 | 低于此值的句子被跳过 | 0.5-0.8 |
| 核心词加分 | +0.2 | 包含核心信息词的加分 | 0.1-0.3 |
| 长度惩罚 | -0.3 | 句子过长的扣分 | 0.2-0.4 |
| 补充词惩罚 | -0.2 | 包含"还"、"然后"的扣分 | 0.15-0.3 |
| 最大句子数 | 2 | simple/normal最多几句 | 1-3 |

#### 验收标准
- ✅ 所有测试用例通过
- ✅ 流式响应流畅无卡顿
- ✅ 没有句子被截断
- ✅ 次要信息被正确过滤
- ✅ 用户体验满意

---

## 📁 文件修改清单

### 新增文件 (2个)
| 文件路径 | 说明 | 代码量 |
|---------|------|-------|
| `src/utils/smartSentenceBuffer.ts` | 智能句子缓冲器 | ~200 行 |
| `src/types/smartBuffer.d.ts` | 类型定义 | ~50 行 |

### 修改文件 (2个)
| 文件路径 | 修改内容 | 影响范围 |
|---------|---------|---------|
| `src/constants/ai.ts` | System Prompt优化 + validateAndOptimizeResponse优化 | ~100 行修改 |
| `src/utils/useChatAI.ts` | 集成SmartSentenceBuffer | ~50 行修改 |

### 新增文档 (1个)
| 文件路径 | 说明 |
|---------|------|
| `docs/SMART_CONTENT_PRIORITIZATION_PLAN.md` | 本实施计划 |

---

## 🎯 里程碑与时间线

### Milestone 1: 基础框架搭建 (1小时)
- ✅ Phase 1: System Prompt优化 (20分钟)
- ✅ Phase 2: SmartSentenceBuffer实现 (45分钟)

**验收**: System Prompt更新完成,SmartSentenceBuffer类实现

---

### Milestone 2: 系统集成 (45分钟)
- ✅ Phase 3: 集成到流式系统 (30分钟)
- ✅ Phase 4: 后置验证优化 (15分钟)

**验收**: 系统可以运行,基础功能正常

---

### Milestone 3: 测试与调优 (30分钟)
- ✅ Phase 5: 全面测试 (20分钟)
- ✅ 参数调优 (10分钟)

**验收**: 所有测试用例通过,用户满意

---

### 总计时间: 2小时15分钟

---

## 📊 成功指标 (KPI)

### 定量指标
- **句子完整率**: ≥ 99% (不被截断)
- **次要信息过滤率**: ≥ 70% (包含"还"、"然后"的句子)
- **流式响应延迟**: ≤ 100ms (第1句开始播放)
- **用户满意度**: ≥ 90% (主观评价)

### 定性指标
- ✅ 回复简短且完整
- ✅ 重点信息优先呈现
- ✅ 流畅的实时体验
- ✅ 不影响现有功能

---

## 🚨 风险与缓解措施

### 风险1: 重要性评分不准确
**影响**: 可能过滤掉重要信息
**缓解**:
- 保证第1句必定播放
- 提供调试日志,便于调优
- 设置较低的阈值 (0.6)

### 风险2: 破坏现有流式逻辑
**影响**: 导致TTS播放异常
**缓解**:
- 详细测试现有功能
- 保持TTS Queue不变
- 可回退到原实现

### 风险3: 调优时间过长
**影响**: 延误上线时间
**缓解**:
- 设置合理的初始参数
- 分阶段调优
- 先上线基础版本

---

## 🔄 回滚计划

如果实施失败,可以快速回滚:

### 回滚步骤
1. 恢复 `src/constants/ai.ts` (git checkout)
2. 删除 `src/utils/smartSentenceBuffer.ts`
3. 恢复 `src/utils/useChatAI.ts` (git checkout)
4. 测试原有功能正常

### 回滚条件
- 测试用例失败率 > 30%
- 流式响应延迟 > 500ms
- 用户体验严重下降

---

## 📋 实施检查清单

### 开始前检查
- [ ] 确认当前代码已提交到Git
- [ ] 创建新的开发分支 `feature/smart-content-priority`
- [ ] 备份关键文件
- [ ] 理解现有流式系统工作原理

### Phase 1 检查
- [ ] System Prompt包含优先级策略
- [ ] 有清晰的示例对比
- [ ] 代码格式正确

### Phase 2 检查
- [ ] SmartSentenceBuffer类实现完整
- [ ] 重要性评分逻辑合理
- [ ] 单元测试通过 (如果有)

### Phase 3 检查
- [ ] 集成不破坏现有功能
- [ ] 调试日志清晰
- [ ] TTS队列工作正常

### Phase 4 检查
- [ ] 验证函数优化完成
- [ ] 句子完整性保证

### Phase 5 检查
- [ ] 所有测试用例通过
- [ ] 参数调优完成
- [ ] 用户体验良好

### 完成后检查
- [ ] 代码review
- [ ] 文档更新
- [ ] 提交PR
- [ ] 合并到主分支

---

## 📚 参考文档

### 相关技术文档
- [AI对话优化文档](./AI_DIALOGUE_OPTIMIZATION.md)
- [对话长度优化文档](./CONVERSATION_LENGTH_OPTIMIZATION.md)
- [流式响应架构](./STREAMING_ARCHITECTURE.md) (如果有)

### 核心文件位置
- System Prompt: `src/constants/ai.ts:35-147`
- 流式处理: `src/utils/useChatAI.ts`
- 句子检测: `src/utils/sentenceDetector.ts`
- TTS队列: `src/utils/ttsQueue.ts`

---

## 🎯 下一步行动

### 立即开始
1. **创建Git分支**: `git checkout -b feature/smart-content-priority`
2. **开始Phase 1**: 更新System Prompt
3. **持续跟踪**: 更新本文档的进度

### 开发顺序
```
Phase 1 (System Prompt)
  → Phase 2 (SmartSentenceBuffer)
  → Phase 4 (后置验证)
  → Phase 3 (集成)
  → Phase 5 (测试)
```

**为什么Phase 4在Phase 3之前?**
因为Phase 4独立于流式系统,可以先完成,降低集成风险。

---

## 📝 进度追踪

### 当前状态
- [ ] Phase 1: System Prompt优化 (0%)
- [ ] Phase 2: SmartSentenceBuffer实现 (0%)
- [ ] Phase 3: 集成到流式系统 (0%)
- [ ] Phase 4: 后置验证优化 (0%)
- [ ] Phase 5: 测试与调优 (0%)

**总体进度**: 0% → 准备开始

---

## 💡 后续优化方向

### 短期优化 (1-2周)
- [ ] 添加更多重要性评分规则
- [ ] 基于用户反馈调整参数
- [ ] 增加问题类型识别 (是什么/为什么/怎么做)

### 中期优化 (1个月)
- [ ] 机器学习重要性评分模型
- [ ] A/B测试不同策略
- [ ] 个性化过滤阈值

### 长期愿景 (3个月+)
- [ ] 上下文感知的重要性判断
- [ ] 多轮对话的信息累积
- [ ] 自适应调整策略

---

**文档维护者**: Claude Code Assistant
**最后更新**: 2025-10-22
**状态**: ✅ 已完成 - 准备实施

---

## 🚀 准备好了吗?

阅读完本计划后,如果你准备好了,请告诉我:

**"开始实施 Phase 1"**

我将立即开始System Prompt的优化工作! 💪

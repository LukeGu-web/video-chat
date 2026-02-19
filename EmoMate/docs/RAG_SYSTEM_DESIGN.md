# RAG 检索增强生成系统

**状态**: ✅ 生产就绪（Phase 1/2/3 全部完成）
**最后更新**: 2026-02-19

---

## 目标

当用户提到过去发生的事情时（"你还记得昨天那本书吗？"），AI 能从历史记录中检索相关信息，而不是只凭当前上下文作答。

---

## 检索数据源

| 数据源 | 存储位置 | 容量 |
|--------|---------|------|
| 聊天记录 | `chatStore`（MMKV 持久化） | 无限制 |
| 物体识别记录 | `objectRecognitionStore`（MMKV） | 最多 50 条 |
| 场景理解记录 | `sceneStore`（MMKV） | 最多 3 条 |

---

## 处理流程

### 1. 查询分析（queryAnalyzer）

分析用户输入，提取：时间信息（"昨天"/"上次"）、关键词、查询意图（回忆/确认/追问）、实体类型（书/物品/场景）。

### 2. 多源检索（multiSourceRetriever）

并行搜索三个数据源，按时间窗口过滤。检索触发条件：查询包含时间引用、或涉及过去提到的物品/场景。

### 3. 相关性排序（relevanceScoring）

综合评分（越近越高权重）：
- 时间相关度（越近越高）
- 关键词匹配度
- 实体类型匹配
- 上下文相关性

### 4. 上下文构建（contextBuilder）

将检索结果格式化为自然语言上下文字符串，注入 AI 系统提示，控制 token 预算。

### 5. 对话摘要（conversationSummarizer，Phase 3）

对话历史较长时，自动生成摘要注入上下文，而不是直接截断。避免重要信息因超出上下文窗口而丢失。

---

## 用户反馈系统（Phase 3）

通过隐式信号（用户是否纠正 AI 的回答）收集反馈，逐步改进检索质量。详见 `capabilities/retrieval/userFeedback.ts`。

---

## 性能监控

`performanceMonitor.ts` 记录每次 RAG 调用的耗时、检索命中率、上下文长度等指标。

---

## 集成方式

RAG 在 `useChatAI.ts` 中集成：每条用户消息发送前，先执行 RAG 检索，将结果拼入系统提示，再发起 Claude API 调用。未触发检索时（`isRetrievalTriggered: false`），直接跳过，不增加延迟。

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/retrieval/ragPipeline.ts` | 主管道，整合所有模块 |
| `capabilities/retrieval/queryAnalyzer.ts` | 查询意图分析 |
| `capabilities/retrieval/multiSourceRetriever.ts` | 多源并行检索 |
| `capabilities/retrieval/relevanceScoring.ts` | 相关性评分 |
| `capabilities/retrieval/contextBuilder.ts` | 上下文构建 |
| `capabilities/retrieval/conversationSummarizer.ts` | 对话摘要 |
| `capabilities/retrieval/userFeedback.ts` | 用户反馈 |
| `capabilities/retrieval/performanceMonitor.ts` | 性能监控 |

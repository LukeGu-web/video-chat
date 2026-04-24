# 记忆系统

**状态**: ✅ 已完整实现（Tasks 1-7 全部完成）
**最后更新**: 2026-02-19

---

## 一、四层记忆架构

### 背景与设计动机

核心问题不只是"AI 不记得你"，而是**用户与 LanLan 之间没有共同生活感**。真正的友谊之所以自然，是因为对方记得你说过的话、会主动提起往事、有持续跟进的话题线。

识别出的五个痛点：

| # | 痛点 | 根因 |
| --- | --- | --- |
| 1 | 每次对话从零开始 | 没有跨 session 持久化 |
| 2 | 回复感觉公式化 | 人格提示词没有用户上下文锚定 |
| 3 | 从不主动提起过去 | 没有记忆注入 |
| 4 | 用户不知道聊什么 | 没有基于共同历史的话题种子 |
| 5 | 对话节奏不自然 | （由人格提示词调优单独处理）|

### 四层架构

**Layer 1 — 用户档案（UserProfile）**

- 存储：MMKV（JSON）
- 更新频率：极低（姓名、职业、标签等基本不变）
- 注入：每次对话都注入
- 包含：姓名、职业、标签（如"学生/夜猫子/内向"）、典型活跃时段、语言偏好

**Layer 2 — 用户偏好（UserPreferences）**

- 存储：MMKV（JSON）
- 更新频率：较慢（从行为中逐步校准）
- 注入：每次对话都注入
- 包含：是否想要建议（`wantsAdvice`）、是否喜欢幽默、回复长度偏好、敏感话题、正式程度

**Layer 3 — 对话摘要（episodes）**

- 存储：SQLite（`episodes` 表）
- 更新频率：每次提取触发后写入
- 注入：最近 5 条
- 每条记录：时间戳、摘要（≤100 字）、话题列表、用户情绪、关键事件、用户最后一句话（`last_words` 用于 session 连续性）

**Layer 4 — 知识事实（facts）**

- 存储：SQLite（`facts` 表）
- 更新频率：实时提取（对话中提到即写入）
- 注入：高重要度事实（最多 20 条）
- 每条记录：创建/更新时间、分类（person/preference/goal/event/opinion）、实体、内容、标签、重要度（high/normal）、过期时间（`expires_at`，处理时效性事实）

### 提取管道

**触发策略**

| 触发器 | 时机 | 作用 |
| --- | --- | --- |
| 每 20 条消息 | 活跃使用中 | 滚动提取，防止消息积压 |
| 5 分钟沉默 | 长时间停顿 | 自然断点 |
| App 进入后台 | 用户关闭/切换 App | 写入 pending flag 到 MMKV |
| App 启动时检查 | 后台后的下次启动 | 处理上次未完成的 pending extraction |

iOS App 进入后台时只有约 30 秒执行时间，异步 API 调用会被系统杀死。解决方案：后台时**只写 MMKV**（毫秒级），下次启动时再处理。

**提取模型**：使用 Claude Haiku（快速且廉价），一次调用同时提取四层数据。

提取结果处理规则：`profile` 仅当发现新信息时更新；`preferences` 仅当检测到明确信号时更新；`episode` 每次必填；`facts` 列出本段对话中提到的可记录事实，无则留空。

### 注入管道

**Token 预算**

| 内容 | Token 估算 |
| --- | --- |
| 用户档案 + 偏好 | ~100 tokens |
| 最近 5 条 episode 摘要 | ~400 tokens |
| 高重要度 facts（最多 20 条）| ~200 tokens |
| **合计** | **~700 tokens** |

**内存块结构**：注入到系统提示的内存块分四节：About this user（姓名/标签/典型活跃时间）、User preferences（风格偏好）、Recent memory（最近 5 条 episode）、Important facts（高重要度事实列表）。

**对话连续性指令**：人格提示词末尾追加——用户发简单打招呼时，LanLan 自然提起一件她记得的事（最近的担忧、即将到来的事件、之前提到的细节）。每次只提一件，不堆砌。

**话题种子（Topic Seeds）**：`useTopicSeeds` 在每次 session 开始时从记忆中生成 2-3 个话题钩子，供主动对话系统在沉默时使用——3 天内即将过期的高重要度 facts、1 天前情绪低落的 episode（跟进关怀）、最新 episode 的 keyEvents。话题种子不直接发送给用户，而是供 LanLan 在对话有停顿时自然引出。

### 已知限制

- 记忆以对话语言存储，不做跨语言检索
- 无记忆编辑 UI，用户暂时无法查看或修正 LanLan 记住的内容
- 用户给出矛盾信息时，最新事实覆盖旧的，无冲突解决逻辑
- 所有数据本地存储，暂无静态加密

### 实现文件

| 文件 | 职责 |
| --- | --- |
| `src/types/memory.ts` | 全部类型定义 |
| `src/store/memoryDatabase.ts` | SQLite 操作（episodes + facts）|
| `src/store/memoryStore.ts` | MMKV 操作（profile + preferences）|
| `src/hooks/useMemoryExtraction.ts` | Claude Haiku 提取 + 写入逻辑 |
| `src/hooks/useMemoryTriggers.ts` | 四种触发器管理 |
| `src/hooks/ai/buildMemoryContext.ts` | 组装内存块字符串 |
| `src/hooks/ai/useTopicSeeds.ts` | 话题种子生成 |
| `App.tsx` | mount 时调用 `loadFromStorage()` hydrate MMKV |

---

## 二、RAG 检索增强生成系统

**状态**: ✅ 生产就绪（Phase 1/2/3 全部完成）

当用户提到过去发生的事情时（"你还记得昨天那本书吗？"），AI 能从历史记录中检索相关信息，而不是只凭当前上下文作答。

### 检索数据源

| 数据源 | 存储位置 | 容量 |
|--------|---------|------|
| 聊天记录 | `chatStore`（MMKV 持久化）| 无限制 |
| 物体识别记录 | `objectRecognitionStore`（MMKV）| 最多 50 条 |
| 场景理解记录 | `sceneStore`（MMKV）| 最多 3 条 |

### 处理流程

1. **查询分析（queryAnalyzer）**：分析用户输入，提取时间信息（"昨天"/"上次"）、关键词、查询意图（回忆/确认/追问）、实体类型（书/物品/场景）。

2. **多源检索（multiSourceRetriever）**：并行搜索三个数据源，按时间窗口过滤。检索触发条件：查询包含时间引用，或涉及过去提到的物品/场景。

3. **相关性排序（relevanceScoring）**：综合评分（时间相关度越近越高、关键词匹配度、实体类型匹配、上下文相关性）。

4. **上下文构建（contextBuilder）**：将检索结果格式化为自然语言上下文字符串，注入 AI 系统提示，控制 token 预算。

5. **对话摘要（conversationSummarizer，Phase 3）**：对话历史较长时，自动生成摘要注入上下文，而不是直接截断，避免重要信息因超出上下文窗口而丢失。

### 其他组件

- **用户反馈系统（Phase 3）**：通过隐式信号（用户是否纠正 AI 的回答）收集反馈，逐步改进检索质量。
- **性能监控**：`performanceMonitor.ts` 记录每次 RAG 调用的耗时、检索命中率、上下文长度等指标。

### 集成方式

RAG 在 `useChatAI.ts` 中集成：每条用户消息发送前，先执行 RAG 检索，将结果拼入系统提示，再发起 Claude API 调用。未触发检索时（`isRetrievalTriggered: false`），直接跳过，不增加延迟。

### 相关文件

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

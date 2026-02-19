# 其他功能

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 一、双语支持

EmoMate 支持中英文双语对话。系统自动检测用户输入语言，AI 用相同语言回复，无需手动切换。UI 界面保持中文不变。

### 检测规则

- 含中文字符 → 中文（zh）
- 纯英文字符 → 英文（en）
- 混合输入（如"hello 你好"）→ 中文（有中文就用中文）
- 空输入 → 默认中文

检测结果持久化到 `userStore.currentLanguage`，保持对话语言连贯，直到用户切换语言输入。

### 全系统覆盖

语言状态影响所有辅助系统：

| 系统 | 中文 | 英文 |
|------|------|------|
| AI 人格提示词 | 默认中文人格 | 末尾追加英文回复指令 |
| 小话系统 | 中文语气词短语 | 英文对应表达 |
| 物品识别宣布 | "这是…" | "This is…" |
| 视觉关键词 | "这是什么"、"看看"等 | "what is this"、"look at this"等 |
| 场景提示 | 中文标签 | 英文标签 |

### 视觉命令（双语）

物品识别命令中英文均可触发：

- **中文**："看这个"、"这是什么"、"识别这个"、"那是什么"等 15 个短语
- **英文**："what is this"、"look at this"、"identify this"等 12 个短语

### 已知限制

- 日语暂未支持
- 记忆与摘要仍以对话语言存储，不做跨语言检索
- 手动语言切换按钮尚未实现（由自动检测覆盖）

### 相关文件

| 文件 | 职责 |
|------|------|
| `src/utils/languageDetection.ts` | 语言检测（Unicode 范围匹配）|
| `src/store/userStore.ts` | `currentLanguage` 状态存储 |
| `src/capabilities/vision/environment/sceneKeywords.ts` | 中英文关键词库 |
| `src/constants/ai.ts` | `createPersonalitySystemPrompt(language)` 动态提示词 |
| `src/utils/smallTalk.ts` | 双语小话数据库 |
| `src/utils/objectRecognitionAnnouncer.ts` | 双语识别宣布模板 |
| `src/capabilities/vision/environment/buildScenePrompt.ts` | 双语场景提示生成 |
| `src/hooks/useChatAI.ts` | 语言检测集成入口 |

---

## 二、SmartSentenceBuffer（已禁用存档）

**状态**: ❌ 已禁用（会导致句子不完整）

`src/capabilities/speak/smartSentenceBuffer.ts` 实现了基于内容评分的智能句子过滤系统（三层防御：System Prompt 排序 → 实时流式过滤 → 后置验证），通过重要性评分（0–1）过滤废话、语气词、反问拖延。

该功能因会导致句子不完整被截断而**禁用**。

目前的内容完整性和简洁性通过以下方式实现：
- **人格提示词**：直接指导 AI 按重要性排序输出，禁止单独语气词，避免废话连接词
- **句子检测优化**：`sentenceDetector.ts` 过滤纯语气词并补全末尾标点（详见 `AI_SYSTEM.md` 第二节）

如需重新启用或参考设计思路，查阅 `smartSentenceBuffer.ts` 源码注释。

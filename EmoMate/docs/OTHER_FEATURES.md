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

## 二、背景场景系统

EmoMate 使用配置驱动的背景场景系统，根据当前时间、星期类型、天气自动选择合适的背景图片，并为 AI 角色提供背景故事上下文。

### 场景分类

背景图片位于 `assets/background/`，按以下维度组织：

- **星期类型**：`everyday`（工作日）/ `weekend`（周末）/ `holiday`（假期）
- **时段**：`morning` / `noon` / `afternoon` / `evening` / `night`
- **天气变体**（可选）：`_sunny` / `_rainy` / `_cloudy` / `_snowy` 后缀

### 场景配置

每个场景在 `src/config/backgroundScenes.ts` 的 `SCENE_CONFIG` 数组中声明：

**必填字段**：场景 ID（格式：`{dayType}_{timePeriod}_{location}`）、星期类型、时段、位置名称、图片路径、描述。

**可选字段**：故事模板 ID、标签数组（用于过滤）、时间范围（24 小时制数组）、天气变体、优先级（1–10）。

优先级决定相同条件下的选择概率：10 = 主场景，8–9 = 常用，6–7 = 次选，1–5 = 罕见/特殊。

### 故事模板

故事模板（`STORY_TEMPLATES`）为每个场景提供对话背景，包含变量占位符：

| 变量 | 含义 |
|------|------|
| `{time}` | 当前时间（"8点半"、"下午3点"）|
| `{weather_desc}` | 天气描述（"阳光明媚"、"淅淅沥沥下着小雨"）|
| `{mood_desc}` | 心情描述 |
| `{activity_desc}` | 当前活动 |
| `{scene_detail}` | 场景细节 |
| `{food_mention}` | 食物提及 |

### 常用标签

**位置类型**：`home`、`school`、`outdoor`、`urban`、`nature`

**活动类型**：`study`、`social`、`relax`、`sports`、`creative`

**氛围**：`quiet`、`peaceful`、`vibrant`、`cozy`

**天气相关**：`weather-aware`（有天气变体的场景）

### 工具函数

`src/config/backgroundScenes.ts` 导出以下工具：

- `getSceneForContext(dayType, currentHour, weather)` — 获取当前上下文的最优场景
- `getSceneImagePath(scene, weather)` — 获取含天气变体的图片路径
- `getScenesByTag(tag)` — 按标签过滤场景
- `getDayType(date)` — 判断今天是工作日/周末/假期

### 添加新场景

1. 将图片放入 `assets/background/{dayType}/{timePeriod}/` 目录
2. 在 `SCENE_CONFIG` 中添加配置条目，设置合理的 `timeRange` 和 `priority`
3. （可选）在 `STORY_TEMPLATES` 中添加对应的故事模板
4. 确保至少有一个场景的优先级较高，避免没有匹配的场景

---

## 三、SmartSentenceBuffer（已禁用存档）

**状态**: ❌ 已禁用（会导致句子不完整）

`src/capabilities/speak/smartSentenceBuffer.ts` 实现了基于内容评分的智能句子过滤系统（三层防御：System Prompt 排序 → 实时流式过滤 → 后置验证），通过重要性评分（0–1）过滤废话、语气词、反问拖延。

该功能因会导致句子不完整被截断而**禁用**。

目前的内容完整性和简洁性通过以下方式实现：
- **人格提示词**：直接指导 AI 按重要性排序输出，禁止单独语气词，避免废话连接词
- **句子检测优化**：`sentenceDetector.ts` 过滤纯语气词并补全末尾标点（详见 `AI_SYSTEM.md` 第二节）

如需重新启用或参考设计思路，查阅 `smartSentenceBuffer.ts` 源码注释。

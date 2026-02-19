# 背景场景系统

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 概述

EmoMate 使用配置驱动的背景场景系统，根据当前时间、星期类型、天气自动选择合适的背景图片，并为 AI 角色提供背景故事上下文。

---

## 场景分类

背景图片位于 `assets/background/`，按以下维度组织：

- **星期类型**：`everyday`（工作日）/ `weekend`（周末）/ `holiday`（假期）
- **时段**：`morning` / `noon` / `afternoon` / `evening` / `night`
- **天气变体**（可选）：`_sunny` / `_rainy` / `_cloudy` / `_snowy` 后缀

---

## 场景配置

每个场景在 `src/config/backgroundScenes.ts` 的 `SCENE_CONFIG` 数组中声明：

**必填字段**：场景 ID（格式：`{dayType}_{timePeriod}_{location}`）、星期类型、时段、位置名称、图片路径、描述。

**可选字段**：故事模板 ID、标签数组（用于过滤）、时间范围（24 小时制数组）、天气变体、优先级（1–10）。

优先级决定相同条件下的选择概率：10 = 主场景，8–9 = 常用，6–7 = 次选，1–5 = 罕见/特殊。

---

## 故事模板

故事模板（`STORY_TEMPLATES`）为每个场景提供对话背景，包含变量占位符：

| 变量 | 含义 |
|------|------|
| `{time}` | 当前时间（"8点半"、"下午3点"）|
| `{weather_desc}` | 天气描述（"阳光明媚"、"淅淅沥沥下着小雨"）|
| `{mood_desc}` | 心情描述 |
| `{activity_desc}` | 当前活动 |
| `{scene_detail}` | 场景细节 |
| `{food_mention}` | 食物提及 |

---

## 常用标签

**位置类型**：`home`、`school`、`outdoor`、`urban`、`nature`

**活动类型**：`study`、`social`、`relax`、`sports`、`creative`

**氛围**：`quiet`、`peaceful`、`vibrant`、`cozy`

**天气相关**：`weather-aware`（有天气变体的场景）

---

## 工具函数

`src/config/backgroundScenes.ts` 导出以下工具：

- `getSceneForContext(dayType, currentHour, weather)` — 获取当前上下文的最优场景
- `getSceneImagePath(scene, weather)` — 获取含天气变体的图片路径
- `getScenesByTag(tag)` — 按标签过滤场景
- `getDayType(date)` — 判断今天是工作日/周末/假期

---

## 添加新场景

1. 将图片放入 `assets/background/{dayType}/{timePeriod}/` 目录
2. 在 `SCENE_CONFIG` 中添加配置条目，设置合理的 `timeRange` 和 `priority`
3. （可选）在 `STORY_TEMPLATES` 中添加对应的故事模板
4. 确保至少有一个场景的优先级较高，避免没有匹配的场景

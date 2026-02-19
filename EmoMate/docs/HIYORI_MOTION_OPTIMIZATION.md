# Hiyori 动作优化 — 上下文感知动作选择

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 概述

原有系统只做简单情绪→动作映射（happy→Happy）。优化后引入 `motionMapper.ts`，综合分析对话文本、情绪状态、AI 状态，选择最恰当的动作，并管理动作优先级和过渡。

---

## 优先级系统

动作选择遵循以下优先级（越高越优先）：

| 优先级 | 类别 | 触发条件 → 动作 |
|--------|------|----------------|
| 4 | 特殊事件 | 庆祝 → Dance；鼓励 → Excited |
| 3 | AI 状态 | 说话中 → Speaking；思考中 → Thinking |
| 2 | 对话场景 | 问候 → Wave；提问 → Thinking；共情 → Sleepy |
| 1 | 基础情绪 | happy → Happy/Dance/Laugh；sad → Sleepy；surprised → Surprised |
| 0 | 默认 | 无特定情况 → Idle |

---

## 文本场景识别

系统通过关键词匹配识别对话场景：

- **问候**：以"你好"/"hi"/"再见"/"bye"开头
- **提问**：含问号或"吗/呢/怎么/为什么/什么/哪里"
- **鼓励/称赞**：含"好棒/厉害/真棒/太好了/加油"
- **庆祝**：含"庆祝/成功了/完成了/耶/万岁"
- **共情**：含"没事吧/怎么了/担心/难过/别哭/安慰"

---

## 情绪 + 上下文组合

某些情绪根据上下文选择更精准的动作：

- happy + 庆祝场景 → Dance（跳舞庆祝）
- happy + 笑声场景 → Laugh
- happy + 问候场景 → Wave（快乐打招呼）
- neutral + 思考 → Thinking
- neutral + 问候 → Wave
- surprised + 害羞 → Shy

---

## 动作时长管理

| 类型 | 动作 | 持续时间 | 完成后 |
|------|------|---------|--------|
| 临时 | Wave / Laugh / Excited | 3 秒 | 自动返回 Idle |
| 临时 | Dance | 5 秒 | 自动返回 Idle |
| 临时 | Surprised | 2 秒 | 自动返回 Idle |
| 循环 | Speaking / Thinking | 持续到状态切换 | 切换动作时停止 |
| 持续 | Idle / Happy / Sleepy / Shy | 无限 | 直到情绪变化 |

Speaking 和 Thinking 动作采用循环播放（每 3 秒重播一次），确保 AI 处于这些状态时角色不会僵住。

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/motion/motionMapper.ts` | 核心映射逻辑，上下文分析，优先级管理 |
| `components/EmotionAwareCharacter.tsx` | 集成 motionMapper，接收 `currentText` 属性 |
| `components/Live2DCharacter.tsx` | 动作循环（Speaking/Thinking）和定时器清理 |
| `store/emotionStore.ts` | 提供 facialEmotion / combinedEmotion 状态 |

---

## 已知限制

- 文本分析仅检查前 100 个字符（长文本可能错过关键词）
- 基于关键词匹配，无法理解反语/讽刺
- 同时满足多个高优先级条件时，取第一个匹配

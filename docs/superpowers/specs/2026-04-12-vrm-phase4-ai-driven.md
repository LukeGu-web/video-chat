# Phase 4 — AI 驱动参数生成

**日期**: 2026-04-12
**前置条件**: Phase 3 验证通过
**目标**: Claude 根据对话内容实时生成 VRM 骨骼/表情参数，实现一次性自然动作与丰富情绪反应

---

## 核心思路

在 Claude 的 system prompt 中加入「VRM 参数手册」——包含所有可用 Blend Shape 名称、骨骼名称及其合理旋转范围。Claude 在生成回复时，同时在 `<action>` 标签内输出对应的 JSON 动作参数，EmoMate 解析后通过 bridge 发送给 WebView。

---

## System Prompt 扩展

在 `buildAIContext.ts` 的 system prompt 中新增一个非缓存块：

```
## 角色动作控制

你在回复时，可以在 <action> 标签内附加动作指令，控制兰兰的表情和肢体动作。

### 可用表情（blend shapes，值范围 0.0~1.0）
- joy: 开心
- sorrow: 悲伤
- angry: 愤怒
- surprised: 惊讶
- fun: 俏皮/调侃
- neutral: 平静（归零其他表情时使用）

### 可用骨骼（旋转弧度，正值方向见说明）
- head: 头部（x:点头+/-0.3, y:摇头+/-0.4, z:歪头+/-0.3）
- neck: 颈部（x:+/-0.2, y:+/-0.3, z:+/-0.2）
- spine: 脊椎（x:前倾+/-0.2, z:+/-0.1）
- rightUpperArm: 右上臂（x:前举0~-1.5, z:侧举0~-1.2）
- rightLowerArm: 右前臂（x:弯曲0~1.5）
- leftUpperArm: 左上臂（x:前举0~-1.5, z:侧举0~1.2）
- leftLowerArm: 左前臂（x:弯曲0~1.5）

### 指令格式
<action>
{
  "blendShapes": { "joy": 0.8, "surprised": 0.2 },
  "bones": {
    "head": { "y": 0.1 },
    "rightUpperArm": { "z": -0.3 }
  },
  "duration": 1.5,
  "easing": "easeOut"
}
</action>

### 使用原则
- 动作应配合当前对话情绪，不要每句话都加动作
- 惊讶/开心/难过等强烈情绪时才附加动作
- 动作幅度适中，避免极端值（如 head.y 不超过 0.4）
- 不需要动作时不输出 <action> 标签
```

---

## EmoMate/ 侧修改

### useChatAI.ts — 流式响应解析

Claude streaming 回复中解析 `<action>` 标签：

```typescript
// 在 streaming 处理中新增
function parseActionFromChunk(chunk: string): VRMCommand | null {
  const match = chunk.match(/<action>([\s\S]*?)<\/action>/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

// 解析到 action 后，发送给 WebView
// 同时从展示文本中剥离 <action>...</action> 标签（用户不可见）
```

### motionMapper.ts — 双轨驱动

Phase 4 完成后，motionMapper 支持两种触发模式：

**模式 1（规则触发）**：情绪分析 → 预设表情 + 预设动作（Phase 2 的逻辑，作为兜底）

**模式 2（AI 生成）**：Claude 直接输出 `<action>` JSON → playPose 消息

优先级：AI 生成 > 规则触发。若 Claude 回复包含 `<action>`，跳过规则触发。

### buildAIContext.ts

新增 VRM 参数手册 block（非缓存，每次请求携带）：

```typescript
{
  type: 'text',
  text: VRM_PARAMETER_MANUAL,  // 上方 system prompt 扩展内容
  // 不加 cache_control，避免手册更新时缓存旧版本
}
```

---

## character/ 侧修改

### ExpressionController.tsx 扩展

新增对 `playPose` 消息的处理（Phase 2 已有此消息类型，本阶段完善 AI 生成参数的兼容性）：

- 参数校验：值超出合理范围时 clamp 到安全范围，避免模型变形
- 与预设动作的优先级处理：AI 动作执行期间暂停 idle 循环，动作结束后恢复

---

## 动作示例

以下是 Claude 在不同场景下应生成的动作示例（用于 prompt 工程测试）：

**场景：用户说了一个笑话**

```json
{
  "blendShapes": { "joy": 0.9, "fun": 0.4 },
  "bones": { "head": { "y": 0.08 } },
  "duration": 1.2,
  "easing": "easeOut"
}
```

**场景：听到令人难过的消息**

```json
{
  "blendShapes": { "sorrow": 0.7 },
  "bones": {
    "head": { "x": 0.15, "y": -0.05 },
    "spine": { "x": 0.1 }
  },
  "duration": 1.5,
  "easing": "easeInOut"
}
```

**场景：被问到难题，思考中**

```json
{
  "blendShapes": { "fun": 0.2 },
  "bones": {
    "head": { "z": 0.15, "y": 0.05 },
    "rightUpperArm": { "x": -0.4 },
    "rightLowerArm": { "x": 1.0 }
  },
  "duration": 2.0,
  "easing": "easeIn"
}
```

---

## 验证标准

Phase 4 完成的判定条件：

- [ ] Claude 回复包含 `<action>` 时，角色做出对应动作
- [ ] `<action>` 标签从用户可见文本和 TTS 读出中被正确剥离
- [ ] 动作幅度自然，无关节扭曲或超出人体范围的姿态
- [ ] 无 `<action>` 的普通回复不影响现有规则触发逻辑（兜底正常工作）
- [ ] 口型同步与 AI 动作同时工作互不干扰
- [ ] 测试 10 轮对话，AI 动作触发率合理（强情绪场景有动作，普通对话不过度触发）

---

## 后续优化方向（不在本阶段）

- 关键帧序列（多个姿态 + 时间戳数组），支持更复杂动画
- 手指骨骼控制（更细腻的手势）
- 动作缓存：高频出现的 AI 动作自动升级为预设

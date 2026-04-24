# Phase 2 — 表情 & 动作系统

**日期**: 2026-04-12
**前置条件**: Phase 1 验证通过
**目标**: 通过 WebView Bridge 控制 VRM 角色的表情（Blend Shapes）和肢体姿态（骨骼旋转），替代原有 Live2D 11 个动作

---

## VRM 表情系统说明

VRM 模型内置两类可编程参数：

### Blend Shapes（表情权重，0.0 ~ 1.0）

| 名称 | 含义 |
|------|------|
| `joy` | 开心 |
| `angry` | 愤怒 |
| `sorrow` | 悲伤 |
| `fun` | 俏皮/开朗 |
| `surprised` | 惊讶 |
| `neutral` | 默认 |
| `blink` | 双眼眨眼 |
| `blinkLeft` / `blinkRight` | 单眼眨眼 |
| `a` `e` `i` `o` `u` | 口型（Phase 3 使用） |

### 骨骼（VRM HumanoidBone 标准名）

```
头部：  head, neck, spine, chest, upperChest
手臂：  leftUpperArm, leftLowerArm, leftHand
        rightUpperArm, rightLowerArm, rightHand
手指：  leftThumbProximal/Intermediate/Distal
        leftIndexProximal/Intermediate/Distal
        （右手同上）
腿部：  leftUpperLeg, leftLowerLeg, leftFoot
        rightUpperLeg, rightLowerLeg, rightFoot
```

骨骼旋转使用 **Euler 角（弧度）**，格式：`{ x, y, z }`，范围参考人体自然活动幅度。

---

## 预设动作库

替代原 Live2D 11 个动作，定义为关键帧序列存储在 WebView 侧：

| 预设名 | 描述 | 关键帧数 |
|--------|------|---------|
| `idle` | 轻微呼吸起伏，头部缓慢微动 | 循环 |
| `speaking` | 上半身微前倾，头部轻微点动 | 循环 |
| `thinking` | 头右倾约 15°，右手托腮姿态 | 单次 |
| `wave` | 右手上举并左右摆动 | 单次 |
| `shy` | 头低垂，双手交叉胸前 | 单次 |
| `excited` | 上半身轻微前倾，双手张开 | 单次 |
| `surprised` | 头后仰，双手微抬 | 单次 |
| `happy` | 小幅度上下跳动感，头部摆动 | 单次 |
| `sleepy` | 头缓慢下垂，眼睛半闭 | 单次 |

---

## Bridge 消息协议

### EmoMate → WebView

**1. 播放预设动作**

```typescript
{
  type: 'playPreset',
  data: {
    name: string,        // 预设名，如 'wave'
    loop?: boolean       // 是否循环（idle/speaking 用）
  }
}
```

**2. 设置表情（Blend Shapes）**

```typescript
{
  type: 'setExpression',
  data: {
    blendShapes: {
      joy?: number,        // 0.0 ~ 1.0
      angry?: number,
      sorrow?: number,
      fun?: number,
      surprised?: number,
      neutral?: number
    },
    duration?: number      // 过渡时长（秒），默认 0.5
  }
}
```

**3. 执行一次性骨骼姿态**

```typescript
{
  type: 'playPose',
  data: {
    blendShapes?: { [key: string]: number },
    bones?: {
      [boneName: string]: { x?: number, y?: number, z?: number }
    },
    duration?: number,     // 持续时长（秒）
    easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  }
}
```

**4. 停止所有动作，回到 idle**

```typescript
{ type: 'stopAll' }
```

---

## character/ 侧实现

### ExpressionController.tsx

React Three Fiber 内的控制组件，职责：

- 接收 bridge 消息，解析动作指令
- 管理当前表情状态，带过渡插值（lerp）
- 管理骨骼旋转状态，带 easing 动画
- `useFrame` 每帧更新 VRM 的 blend shape weight 和 bone rotation
- 自动随机眨眼（0.5 ~ 4 秒随机间隔）

### 过渡动画

所有表情/姿态变化使用线性插值（lerp），避免突变：

```
当前值 → 目标值，在 duration 时间内平滑过渡
```

---

## EmoMate/ 侧修改

### motionMapper.ts 重写

原文件将情绪映射到 Live2D 动作名字符串，改为映射到 VRM 指令对象：

```typescript
// 原来
emotionToMotion(emotion: string): string  // 返回 'Happy'

// 改为
emotionToVRMCommand(emotion: string, intensity: number): VRMCommand
// 返回 { type: 'setExpression', data: { blendShapes: { joy: 0.8 }, duration: 0.5 } }
//     + { type: 'playPreset', data: { name: 'happy' } }
```

### 情绪 → VRM 表情映射表

| Claude 情绪 | Blend Shape | 预设动作 |
|------------|-------------|---------|
| joy | `{ joy: 0.8 }` | `happy` |
| sadness | `{ sorrow: 0.7 }` | 无 |
| anger | `{ angry: 0.6 }` | 无 |
| fear | `{ surprised: 0.5, sorrow: 0.3 }` | `shy` |
| surprise | `{ surprised: 0.9 }` | `surprised` |
| disgust | `{ angry: 0.4, sorrow: 0.2 }` | 无 |
| trust | `{ joy: 0.4, fun: 0.3 }` | 无 |
| anticipation | `{ fun: 0.5 }` | `thinking` |

---

## 验证标准

Phase 2 完成的判定条件：

- [ ] EmoMate 发送 `playPreset: 'wave'`，角色做出挥手动作
- [ ] EmoMate 发送 `setExpression: { joy: 0.8 }`，角色变为开心表情
- [ ] EmoMate 发送 `playPose`（含骨骼参数），角色做出对应姿态
- [ ] 表情/动作之间有平滑过渡，无跳变
- [ ] 自动随机眨眼正常工作
- [ ] 对话中情绪识别后自动触发对应表情（接入 motionMapper）
- [ ] 发送 `stopAll` 后角色回到 idle 状态

---

## 不在本阶段做

- 口型同步（Phase 3）
- AI 生成骨骼参数（Phase 4）
- 多角色支持

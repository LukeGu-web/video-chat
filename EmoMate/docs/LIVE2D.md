# Live2D 角色系统

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 一、Hiyori Live2D 集成

Hiyori 是 EmoMate 的 Live2D 虚拟角色，通过 WebView 嵌入显示。React Native（EmoMate）与 Web 应用（character/）之间通过 JavaScript Bridge 双向通信，实现动作控制和状态同步。

### 架构

EmoMate（React Native）内嵌 HiyoriWebView，连接到 character 项目（Remix + PIXI.js + Live2D），两端通过 HiyoriBridge（JavaScript Bridge）通信。

Character 服务器在本地开发时运行于 `http://<network-ip>:5174/`，EmoMate 的 WebView 通过网络 IP 连接（需在同一局域网）。

### 11 种动作

| 动作 | 场景 | 类型 |
|------|------|------|
| Idle | 默认待机 | 持续 |
| Happy | 开心情绪 | 持续 |
| Shy | 害羞状态 | 持续 |
| Sleepy | 疲惫/悲伤 | 持续 |
| Speaking | AI 说话中 | 持续（循环）|
| Thinking | AI 思考中 | 临时（循环）|
| Wave | 问候/告别 | 临时（3 秒）|
| Dance | 庆祝/欢乐 | 临时（5 秒）|
| Laugh | 笑声/幽默 | 临时（3 秒）|
| Excited | 兴奋/激动 | 临时（3 秒）|
| Surprised | 惊讶反应 | 临时（2 秒）|

临时动作播放完成后自动返回 Idle；Speaking/Thinking 则循环播放直到状态切换。

### Bridge 通信协议

所有消息使用 JSON 格式：

| 消息类型 | 方向 | 用途 |
|---------|------|------|
| `domReady` | character → EmoMate | DOM 初始化完成 |
| `modelReady` | character → EmoMate | Live2D 加载就绪 |
| `motionResult` | character → EmoMate | 动作执行结果 |
| `heartbeat` | character → EmoMate | 连接保活（5 秒间隔）|
| `initError` | character → EmoMate | 初始化错误 |
| `playMotion` | EmoMate → character | 触发动作命令 |

### 情绪 → 动作自动映射

情绪检测结果通过 `motionMapper.ts` 自动转换为 Hiyori 动作。AI 说话时优先显示 Speaking 动作，用户问候时优先显示 Wave。详见下文第二节。

### 开发注意事项

- Character 服务器必须以 `0.0.0.0` 绑定（已在 `vite.config.ts` 配置）才能从手机访问
- WebView 中 JavaScript 注入需等待 `modelReady` 消息后才能执行
- 调试时设置环境变量 `SHOW_TEST_COMPONENTS=true` 可显示连接状态和动作历史

### 相关文件

| 文件 | 职责 |
|------|------|
| `components/HiyoriWebView.tsx` | WebView 封装，Bridge 通信，初始化状态跟踪 |
| `components/EmotionAwareCharacter.tsx` | 情绪感知的动作控制组件 |
| `components/Live2DCharacter.tsx` | 动作选择和循环管理 |
| `capabilities/motion/motionMapper.ts` | 情绪 + 上下文 → 动作映射逻辑 |
| `screens/HiyoriScreen.tsx` | Hiyori 测试/展示界面 |
| `../character/` | Live2D Web 应用（独立项目）|

---

## 二、上下文感知动作选择

原有系统只做简单情绪→动作映射（happy→Happy）。优化后引入 `motionMapper.ts`，综合分析对话文本、情绪状态、AI 状态，选择最恰当的动作，并管理动作优先级和过渡。

### 优先级系统

动作选择遵循以下优先级（越高越优先）：

| 优先级 | 类别 | 触发条件 → 动作 |
|--------|------|----------------|
| 4 | 特殊事件 | 庆祝 → Dance；鼓励 → Excited |
| 3 | AI 状态 | 说话中 → Speaking；思考中 → Thinking |
| 2 | 对话场景 | 问候 → Wave；提问 → Thinking；共情 → Sleepy |
| 1 | 基础情绪 | happy → Happy/Dance/Laugh；sad → Sleepy；surprised → Surprised |
| 0 | 默认 | 无特定情况 → Idle |

### 文本场景识别

系统通过关键词匹配识别对话场景：

- **问候**：以"你好"/"hi"/"再见"/"bye"开头
- **提问**：含问号或"吗/呢/怎么/为什么/什么/哪里"
- **鼓励/称赞**：含"好棒/厉害/真棒/太好了/加油"
- **庆祝**：含"庆祝/成功了/完成了/耶/万岁"
- **共情**：含"没事吧/怎么了/担心/难过/别哭/安慰"

### 情绪 + 上下文组合

某些情绪根据上下文选择更精准的动作：

- happy + 庆祝场景 → Dance（跳舞庆祝）
- happy + 笑声场景 → Laugh
- happy + 问候场景 → Wave（快乐打招呼）
- neutral + 思考 → Thinking
- neutral + 问候 → Wave
- surprised + 害羞 → Shy

### 动作时长管理

| 类型 | 动作 | 持续时间 | 完成后 |
|------|------|---------|--------|
| 临时 | Wave / Laugh / Excited | 3 秒 | 自动返回 Idle |
| 临时 | Dance | 5 秒 | 自动返回 Idle |
| 临时 | Surprised | 2 秒 | 自动返回 Idle |
| 循环 | Speaking / Thinking | 持续到状态切换 | 切换动作时停止 |
| 持续 | Idle / Happy / Sleepy / Shy | 无限 | 直到情绪变化 |

### 已知限制

- 文本分析仅检查前 100 个字符（长文本可能错过关键词）
- 基于关键词匹配，无法理解反语/讽刺
- 同时满足多个高优先级条件时，取第一个匹配

### 相关文件

| 文件 | 职责 |
|------|------|
| `capabilities/motion/motionMapper.ts` | 核心映射逻辑，上下文分析，优先级管理 |
| `components/EmotionAwareCharacter.tsx` | 集成 motionMapper，接收 `currentText` 属性 |
| `components/Live2DCharacter.tsx` | 动作循环（Speaking/Thinking）和定时器清理 |
| `store/emotionStore.ts` | 提供 facialEmotion / combinedEmotion 状态 |

---

## 三、动作循环播放

Speaking 和 Thinking 是持续性动作，需要在 AI 处于相应状态期间持续循环播放，而不是只播放一次就停止。

### 设计原则

- **持续性动作**（Speaking、Thinking）：每 3 秒重播一次，直到状态切换
- **临时动作**（Wave、Dance、Laugh 等）：播放一次，完成后自动返回 Idle
- 动作切换时立即停止之前的循环，防止两个循环并发

循环间隔设为 3 秒的原因：Hiyori 单个动作时长约 2–3 秒，3 秒间隔确保动作播放完整不重叠，视觉连贯，不会有明显停顿。

### 内存管理

所有循环 interval 存于 `useRef`，确保组件卸载时清理（useEffect cleanup）、动作切换时停止之前的循环、不重复启动同一动作的循环。

### 实现位置

循环逻辑位于 `components/Live2DCharacter.tsx`：

- `shouldLoopMotion(motionName)` — 判断动作是否需要循环
- 启动循环：`setInterval` 每 3 秒调用 `hiyoriBridge.playMotion`
- 停止循环：`clearInterval`，在动作切换和组件卸载时触发

调试模式下控制台可见循环启动/停止/重播日志。

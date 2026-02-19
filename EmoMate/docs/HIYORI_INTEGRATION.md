# Hiyori Live2D 集成

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 概述

Hiyori 是 EmoMate 的 Live2D 虚拟角色，通过 WebView 嵌入显示。React Native（EmoMate）与 Web 应用（character/）之间通过 JavaScript Bridge 双向通信，实现动作控制和状态同步。

---

## 架构

```
EmoMate（React Native）
  └─ HiyoriWebView（WebView 封装）
       └─ character 项目（Remix + PIXI.js + Live2D）
            └─ HiyoriBridge（JavaScript Bridge）
```

Character 服务器在本地开发时运行于 `http://<network-ip>:5174/`，EmoMate 的 WebView 通过网络 IP 连接（需在同一局域网）。

---

## 11 种动作

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

---

## Bridge 通信协议

所有消息使用 JSON 格式：

| 消息类型 | 方向 | 用途 |
|---------|------|------|
| `domReady` | character → EmoMate | DOM 初始化完成 |
| `modelReady` | character → EmoMate | Live2D 加载就绪 |
| `motionResult` | character → EmoMate | 动作执行结果 |
| `heartbeat` | character → EmoMate | 连接保活（5 秒间隔）|
| `initError` | character → EmoMate | 初始化错误 |
| `playMotion` | EmoMate → character | 触发动作命令 |

---

## 情绪 → 动作自动映射

情绪检测结果通过 `motionMapper.ts` 自动转换为 Hiyori 动作。AI 说话时优先显示 Speaking 动作，用户问候时优先显示 Wave。详见 [HIYORI_MOTION_OPTIMIZATION.md](./HIYORI_MOTION_OPTIMIZATION.md)。

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `components/HiyoriWebView.tsx` | WebView 封装，Bridge 通信，初始化状态跟踪 |
| `components/EmotionAwareCharacter.tsx` | 情绪感知的动作控制组件 |
| `components/Live2DCharacter.tsx` | 动作选择和循环管理 |
| `capabilities/motion/motionMapper.ts` | 情绪 + 上下文 → 动作映射逻辑 |
| `screens/HiyoriScreen.tsx` | Hiyori 测试/展示界面 |
| `../character/` | Live2D Web 应用（独立项目）|

---

## 开发注意事项

- Character 服务器必须以 `0.0.0.0` 绑定（已在 `vite.config.ts` 配置）才能从手机访问
- WebView 中 JavaScript 注入需等待 `modelReady` 消息后才能执行
- 调试时设置环境变量 `SHOW_TEST_COMPONENTS=true` 可显示连接状态和动作历史

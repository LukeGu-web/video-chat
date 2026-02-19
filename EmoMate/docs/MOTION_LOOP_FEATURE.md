# 动作循环播放

**状态**: ✅ 生产就绪
**最后更新**: 2026-02-19

---

## 概述

Speaking 和 Thinking 是持续性动作，需要在 AI 处于相应状态期间持续循环播放，而不是只播放一次就停止。EmoMate 实现了智能动作循环系统来处理这个需求。

---

## 设计原则

- **持续性动作**（Speaking、Thinking）：每 3 秒重播一次，直到状态切换
- **临时动作**（Wave、Dance、Laugh 等）：播放一次，完成后自动返回 Idle
- 动作切换时立即停止之前的循环，防止两个循环并发

---

## 循环参数

循环间隔设为 3 秒，原因：
- Hiyori 单个动作时长约 2–3 秒
- 3 秒间隔确保动作播放完整不重叠
- 视觉连贯，不会有明显停顿

---

## 内存管理

所有循环 interval 存于 `useRef`，确保：
- 组件卸载时清理（useEffect cleanup）
- 动作切换时停止之前的循环
- 不重复启动同一动作的循环

---

## 实现位置

循环逻辑位于 `components/Live2DCharacter.tsx`：

- `shouldLoopMotion(motionName)` — 判断动作是否需要循环
- 启动循环：`setInterval` 每 3 秒调用 `hiyoriBridge.playMotion`
- 停止循环：`clearInterval`，在动作切换和组件卸载时触发

调试模式下控制台可见循环启动/停止/重播日志。

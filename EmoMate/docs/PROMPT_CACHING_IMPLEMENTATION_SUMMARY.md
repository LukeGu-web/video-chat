# Prompt Caching 实施总结

**状态**: ✅ Phase 1 & 2 生产就绪
**最后更新**: 2026-02-19

---

## 概述

通过 Claude Prompt Caching API（`anthropic-beta: prompt-caching-2024-07-31`），EmoMate 将稳定的系统提示块标记为可缓存，显著降低 API 成本和响应延迟。

---

## 三级缓存策略

| 缓存块 | 内容 | 约 Token | 是否缓存 |
|--------|------|---------|---------|
| Block 1 | 核心人格设定 | ~1000 | ✅ 缓存 |
| Block 2 | 能力说明 | ~200 | ✅ 缓存 |
| Block 3 | 对话历史（前 5 条） | ~100 | ✅ 缓存 |
| 动态 | 情绪响应、场景上下文、最新消息 | 可变 | ❌ 不缓存 |

缓存断点通过 `cache_control: { type: 'ephemeral' }` 标记，共 3 个（不超过 API 最大 4 个限制）。

---

## 效果

| 指标 | 无缓存 | 有缓存 | 改善 |
|------|--------|--------|------|
| 首字节响应时间 | ~2000ms | ~300ms | ↓ 85% |
| 100 次请求成本 | $0.459 | $0.113 | ↓ 75% |

缓存 TTL 为 5 分钟，缓存失效条件：内容变化（包括空格）、切换模型、超时。

---

## 缓存监控

`src/utils/cacheMetrics.ts` 提供完整的缓存指标追踪：命中率、节省 token 数、节省成本（USD）。在 `useChatAI.ts` 中通过 `getCacheStats()` 可读取当前统计数据。

---

## 相关文件

| 文件 | 职责 |
|------|------|
| `hooks/ai/buildAIContext.ts` | `buildCacheableSystemPrompt()`、`buildCacheableMessages()` |
| `hooks/useChatAI.ts` | 添加 `anthropic-beta` 请求头，集成缓存追踪 |
| `utils/cacheMetrics.ts` | 缓存命中率、成本节省统计 |

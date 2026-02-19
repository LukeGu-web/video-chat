# SmartSentenceBuffer — 已禁用

**状态**: ❌ 已禁用（会导致句子不完整）
**最后更新**: 2026-02-19

---

## 说明

`src/capabilities/speak/smartSentenceBuffer.ts` 实现了基于内容评分的智能句子过滤系统（三层防御：System Prompt 排序 → 实时流式过滤 → 后置验证），通过重要性评分（0–1）过滤废话、语气词、反问拖延。

该功能因会导致句子不完整被截断而**禁用**。

目前的内容完整性和简洁性通过以下方式实现：
- **人格提示词**：直接指导 AI 按重要性排序输出，禁止单独语气词，避免废话连接词
- **句子检测优化**：`sentenceDetector.ts` 过滤纯语气词并补全末尾标点（详见 [AI_DIALOGUE_OPTIMIZATION.md](./AI_DIALOGUE_OPTIMIZATION.md)）

如需重新启用或参考设计思路，查阅 `smartSentenceBuffer.ts` 源码注释。

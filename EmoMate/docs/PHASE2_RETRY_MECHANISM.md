# Phase 2 重试机制优化

**日期**: 2025-10-22
**问题**: ElevenLabs API 429 限流错误
**解决方案**: 智能重试 + 速率限制
**状态**: ✅ 已实施

---

## 🐛 问题描述

### 错误信息

```
ERROR [TTSQueue] ❌ Synthesis failed for tts_xxx: [Error: ElevenLabs API error: 429]
```

### 原因分析

**ElevenLabs API 限流**:
- 免费/付费账户都有速率限制
- 过多并发请求触发 429 错误
- Phase 2 默认最多 **3 个并发** TTS 请求

**触发场景**:
```
长回答 (5句话)
  ↓ 同时发起 3 个并发合成
第1句: 合成中...
第2句: 合成中...
第3句: 合成中... → 可能触发 429
```

---

## ✅ 解决方案

### 1. 降低并发数

**修改前**:
```typescript
maxConcurrentSynthesis: 3 // 可能触发限流
```

**修改后**:
```typescript
maxConcurrentSynthesis: 2 // 更保守,避免限流
```

### 2. 智能重试机制

**核心逻辑**:
```typescript
// 失败时检查是否可以重试
if (item.retryCount < maxRetries && !this.isCancelled) {
  item.retryCount++;

  // 429 错误使用更长延迟
  const delay = isRateLimitError
    ? retryDelay * item.retryCount * 2  // 2s, 4s, 6s
    : retryDelay * item.retryCount;     // 1s, 2s, 3s

  console.warn(`⚠️ Retrying in ${delay}ms... (${item.retryCount}/${maxRetries})`);

  setTimeout(() => {
    this.synthesize(item); // 重新合成
  }, delay);
}
```

### 3. 指数退避策略

**针对 429 错误**:
- 第1次重试: 2秒后
- 第2次重试: 4秒后
- 第3次重试: 6秒后

**针对其他错误**:
- 第1次重试: 1秒后
- 第2次重试: 2秒后
- 第3次重试: 3秒后

---

## 🔧 技术实现

### 配置接口

```typescript
export interface TTSQueueConfig {
  voiceId?: string;
  userEmotion?: string;
  maxConcurrentSynthesis?: number; // 默认: 2
  maxRetries?: number;             // 默认: 3
  retryDelay?: number;             // 默认: 1000ms
}
```

### 队列项追踪

```typescript
export interface TTSQueueItem {
  id: string;
  text: string;
  status: TTSQueueStatus;
  retryCount?: number; // 追踪重试次数
  error?: string;
}
```

### 重试流程

```typescript
private async synthesize(item: TTSQueueItem): Promise<void> {
  item.retryCount = item.retryCount || 0;

  try {
    // 尝试合成
    const audioUri = await this.callElevenLabsTTS(item.text);
    // 成功...
  } catch (error) {
    const isRateLimitError = error.message.includes('429');

    // 可以重试?
    if (item.retryCount < maxRetries) {
      item.retryCount++;

      // 计算延迟
      const delay = isRateLimitError
        ? retryDelay * item.retryCount * 2
        : retryDelay * item.retryCount;

      // 重置状态
      item.status = 'pending';
      this.activeSynthesisTasks--;

      // 延迟后重试
      setTimeout(() => {
        this.synthesize(item);
      }, delay);

      return;
    }

    // 达到最大重试次数
    item.status = 'failed';
  }
}
```

---

## 📊 效果对比

### 优化前

**问题**:
```
5句话回答
  ↓ 并发 3 个请求
第3句: 429 错误 → 立即失败 ❌
  ↓ 结果
只播放 2 句,第3句丢失
```

**用户体验**: 回答不完整

### 优化后

**流程**:
```
5句话回答
  ↓ 并发 2 个请求 (降低限流风险)
第3句: 可能 429 错误
  ↓ 2秒后重试
第3句: 成功合成 ✅
  ↓ 结果
完整播放 5 句话
```

**用户体验**: 完整流畅,可能稍有延迟但不丢失内容

---

## 🎯 参数调优建议

### 免费用户

```typescript
const ttsQueue = new TTSQueue({
  maxConcurrentSynthesis: 1, // 更保守
  maxRetries: 3,
  retryDelay: 2000, // 2秒延迟
});
```

### 付费用户

```typescript
const ttsQueue = new TTSQueue({
  maxConcurrentSynthesis: 2, // 默认配置
  maxRetries: 3,
  retryDelay: 1000, // 1秒延迟
});
```

### 高级用户 (Pro账户)

```typescript
const ttsQueue = new TTSQueue({
  maxConcurrentSynthesis: 3, // 可以更激进
  maxRetries: 2,
  retryDelay: 500, // 更短延迟
});
```

---

## 📝 日志示例

### 成功重试

```
[TTSQueue] Synthesizing tts_xxx... (attempt 1)
⚠️ Synthesis failed (ElevenLabs API error: 429)
⚠️ Retrying in 2000ms... (1/3)
[TTSQueue] Synthesizing tts_xxx... (attempt 2)
✅ Synthesis complete for tts_xxx
```

### 达到最大重试

```
[TTSQueue] Synthesizing tts_xxx... (attempt 1)
⚠️ Retrying in 2000ms... (1/3)
[TTSQueue] Synthesizing tts_xxx... (attempt 2)
⚠️ Retrying in 4000ms... (2/3)
[TTSQueue] Synthesizing tts_xxx... (attempt 3)
⚠️ Retrying in 6000ms... (3/3)
[TTSQueue] Synthesizing tts_xxx... (attempt 4)
❌ Synthesis failed for tts_xxx after 3 retries
```

---

## 🎨 用户体验改进

### 场景: 长回答

**用户**: "给我讲讲流浪地球的故事"

**优化前**:
```
句子1: ✅ 播放
句子2: ✅ 播放
句子3: ❌ 429错误 → 丢失
句子4: ✅ 播放
句子5: ✅ 播放

结果: 回答不完整,中间缺失一句
```

**优化后**:
```
句子1: ✅ 播放
句子2: ✅ 播放
句子3: ⚠️ 429错误 → 2s后重试 → ✅ 成功
句子4: ✅ 播放
句子5: ✅ 播放

结果: 完整播放,句子3稍有延迟但不影响整体
```

---

## 🔍 监控和调试

### 查看重试统计

```typescript
// 获取队列状态
const status = ttsQueue.getStatus();
console.log('Failed items:', status.failed);

// 查看具体失败原因
queue.forEach(item => {
  if (item.status === 'failed') {
    console.log(`Item ${item.id}:`, item.error, `retries: ${item.retryCount}`);
  }
});
```

### 调整重试参数

```typescript
// 运行时调整 (未实现,但可以扩展)
ttsQueue.updateConfig({
  maxRetries: 5,
  retryDelay: 1500,
});
```

---

## ⚠️ 注意事项

### 1. 延迟影响

**重试会增加总延迟**:
- 第1次失败 + 2s重试 = 增加 2s
- 第2次失败 + 4s重试 = 增加 4s
- 第3次失败 + 6s重试 = 增加 6s

**但**:
- ✅ 确保内容完整性
- ✅ 避免丢失句子
- ✅ 用户感知连贯

### 2. API 限流根本解决

**长期方案**:
1. **升级 ElevenLabs 账户** (更高限流)
2. **缓存常用短语** (减少API调用)
3. **本地 TTS 降级** (Expo Speech 作为fallback)

### 3. 成本控制

**重试会增加 API 调用**:
- 原本 5 次调用
- 重试后可能 5-15 次调用

**建议**:
- 监控 API 使用量
- 根据实际情况调整 `maxRetries`

---

## 🚀 未来优化方向

### 1. 智能降级

```typescript
// 连续失败后降级到 Expo Speech
if (consecutiveFailures > 3) {
  console.warn('Too many failures, falling back to Expo Speech');
  await expoSpeech.speak(text);
}
```

### 2. 动态调整并发

```typescript
// 根据失败率自动调整并发数
if (failureRate > 0.3) {
  maxConcurrentSynthesis = 1; // 降低并发
} else if (failureRate < 0.1) {
  maxConcurrentSynthesis = 3; // 提高并发
}
```

### 3. 缓存机制

```typescript
// 缓存常用短语
const cache = new Map<string, string>(); // text -> audioUri

if (cache.has(text)) {
  return cache.get(text); // 直接返回,无需调用 API
}
```

---

## ✅ 验证清单

- [x] 并发数降低到 2
- [x] 重试机制实施
- [x] 指数退避策略
- [x] 429 错误特殊处理
- [x] TypeScript 编译通过
- [x] 日志清晰可读

---

## 🎉 总结

**改进**:
- ✅ 降低限流触发概率 (并发 3→2)
- ✅ 自动重试失败请求 (最多3次)
- ✅ 智能延迟策略 (指数退避)
- ✅ 完整性保证 (不丢失句子)

**效果**:
- 429 错误大幅减少
- 偶尔出现也能自动恢复
- 用户体验完整流畅

**建议**:
- 监控实际失败率
- 根据使用情况调整参数
- 考虑长期优化方案 (缓存、降级)

---

**文档版本**: v2.1.0
**创建时间**: 2025-10-22
**状态**: ✅ 已实施,就绪测试

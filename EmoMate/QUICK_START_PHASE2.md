# Phase 2 快速测试指南

**当前状态**: ✅ Phase 2 实施完成
**待测试**: 流式响应 + TTS队列 + 过渡语音无缝衔接
**预计时间**: 30分钟测试

---

## 🚀 快速开始 (3步完成)

### 第 1 步: 确认环境 (2分钟)

```bash
# 确认在 EmoMate 目录
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate

# 检查 API Keys
cat .env | grep ANTHROPIC_API_KEY
cat .env | grep ELEVENLABS_API_KEY

# 确认过渡音频文件存在
ls -la assets/audio/transitions/
```

**预期结果**:
- ✅ 两个 API Keys 都已配置
- ✅ 17个 .mp3 音频文件

---

### 第 2 步: 启动应用 (1分钟)

```bash
# 启动开发服务器
npm start
```

**使用 Expo Go 或 Development Build 扫码启动**

---

### 第 3 步: 测试 Phase 2 功能 (30分钟)

#### 测试场景 1: 简单问候 ⭐ 最重要

**操作**:
1. 在聊天界面发送: **"你好"**
2. **立即观察** 音频播放

**预期结果**:
```
[0.3s] 🔊 过渡语音: "嗯~" 或 "好的呢~" (acknowledgment 类别)
[1.5s] ⏸️ 过渡语音停止
[1.5s] 🎵 真实回答开始: "你好呀!"
[继续] 🎵 后续句子 (如有)
```

**验证指标**:
- [ ] 过渡语音在 **0.5s 内** 播放
- [ ] 真实回答在 **2s 内** 开始
- [ ] 过渡语音和真实回答 **无重叠**
- [ ] 切换 **无明显间隙**

**控制台日志** (期望看到):
```
[ChatAI] Phase 2: 过渡语音类别: acknowledgment
[ChatAI] 🔊 Phase 2: 播放过渡语音
[TransitionAudio] ✅ 播放过渡语音 [acknowledgment]: acknowledgment_01
[ChatAI] Streaming sentence detected: "你好呀!"
[ChatAI] ⏸️ Phase 2: 停止过渡语音,开始真实回答
[TransitionAudio] ⏸️ 停止过渡语音
[ChatAI] 🎵 Phase 2: 加入TTS队列: "你好呀!"
[TTSQueue] Enqueued sentence tts_xxx: "你好呀!"
[TTSQueue] Synthesizing tts_xxx...
[TTSQueue] ✅ Synthesis complete for tts_xxx
[TTSQueue] 🔊 Playing tts_xxx: "你好呀!"
[ChatAI] ✅ Phase 2: TTS队列播放完成
```

---

#### 测试场景 2: 提问 (疑问类过渡语音)

**操作**:
发送: **"今天天气怎么样?"**

**预期结果**:
```
[0.3s] 🔊 过渡语音: "欸?" 或 "什么呢?" (question 类别)
[1.5s] ⏸️ 停止过渡语音
[1.5s] 🎵 真实回答: "今天天气..."
```

**验证指标**:
- [ ] 过渡语音类别正确 (question)
- [ ] 无缝切换
- [ ] 回答内容相关

---

#### 测试场景 3: 情绪对话 (兴奋类过渡语音)

**操作**:
发送: **"我今天好开心!"**

**预期结果**:
```
[0.3s] 🔊 过渡语音: "哇!" 或 "真的吗?" (excited 类别)
[1.5s] ⏸️ 停止过渡语音
[1.5s] 🎵 真实回答: "太好了!..."
```

**验证指标**:
- [ ] 过渡语音类别正确 (excited)
- [ ] 情绪匹配
- [ ] 回答情感适当

---

#### 测试场景 4: 长回答 (多句子流式播放)

**操作**:
发送: **"给我讲讲流浪地球的故事"**

**预期结果**:
```
[0.3s] 🔊 过渡语音: "让我想想..." (thinking 类别)
[1.5s] ⏸️ 停止过渡语音
[1.5s] 🎵 第一句: "《流浪地球》讲述了..."
[2.0s] 🎵 第二句: "太阳即将毁灭..."
[2.5s] 🎵 第三句: "人类决定..."
[继续流式播放...]
```

**验证指标**:
- [ ] 每个句子独立合成和播放
- [ ] 句子顺序正确
- [ ] 句子之间无明显间隙
- [ ] 句子之间无重叠

**控制台日志** (期望看到):
```
[ChatAI] Streaming sentence detected: "《流浪地球》讲述了..."
[TTSQueue] Enqueued sentence tts_xxx_1: "《流浪地球》讲述了..."
[ChatAI] Streaming sentence detected: "太阳即将毁灭..."
[TTSQueue] Enqueued sentence tts_xxx_2: "太阳即将毁灭..."
[TTSQueue] Synthesizing tts_xxx_1...
[TTSQueue] Synthesizing tts_xxx_2... (并行合成)
[TTSQueue] 🔊 Playing tts_xxx_1: "《流浪地球》讲述了..."
[TTSQueue] 🔊 Playing tts_xxx_2: "太阳即将毁灭..." (顺序播放)
```

---

#### 测试场景 5: 错误处理

**操作 A: 网络中断**
1. 发送消息
2. 在过渡语音播放时 **快速关闭 WiFi**

**预期结果**:
- [ ] 显示错误提示
- [ ] 过渡语音停止
- [ ] TTS 队列取消
- [ ] 应用不崩溃

**操作 B: 快速连续发送**
1. 快速连续发送 3 条消息

**预期结果**:
- [ ] 前一条消息被中断
- [ ] 最新消息正常处理
- [ ] 资源正确清理

---

## 📊 性能验证

### 关键指标测量

使用秒表或观察控制台时间戳:

| 指标 | 目标 | 实际 | 状态 |
|-----|------|------|------|
| 过渡语音延迟 | < 0.5s | ___ | [ ] |
| 首句真实回答 | < 2s | ___ | [ ] |
| 句子间隙 | < 0.5s | ___ | [ ] |
| 总体流畅度 | 无卡顿 | ___ | [ ] |

---

## 🐛 故障排除

### 问题 1: 过渡语音不播放

**检查**:
```bash
# 验证音频文件
ls -la assets/audio/transitions/ | wc -l
# 应该看到 17 个文件 (+ 2 个目录行 = 19)

# 检查控制台
# 应该看到: [TransitionAudio] 预加载完成！
```

**解决**:
- 确认音频文件存在
- 检查 App.tsx 中的预加载逻辑
- 查看控制台错误

---

### 问题 2: 流式响应失败

**检查**:
```bash
# 验证 Claude API Key
cat .env | grep ANTHROPIC_API_KEY
```

**控制台可能出现**:
```
[ChatAI] Streaming error: ...
```

**解决**:
- 检查 API Key 有效性
- 检查网络连接
- 查看 Claude API 限流

---

### 问题 3: TTS 队列卡住

**症状**:
- 过渡语音播放
- 但真实回答不播放

**检查控制台**:
```
[TTSQueue] Synthesizing tts_xxx...
# 卡在这里,没有 "Synthesis complete"
```

**解决**:
- 检查 ElevenLabs API Key
- 检查网络连接
- 重启应用

---

### 问题 4: TypeScript 编译错误

**检查**:
```bash
npx tsc --noEmit
```

**预期**: 无错误输出

---

## ✅ 验收标准

### 功能验收

- [ ] 过渡语音在 0.5s 内播放
- [ ] 真实回答在 2s 内开始
- [ ] 过渡语音和真实回答无缝切换
- [ ] 多句子按顺序流式播放
- [ ] 句子之间无重叠和明显间隙
- [ ] 错误情况下应用不崩溃
- [ ] 资源正确清理 (无内存泄漏)

### 体验验收

- [ ] 对话感觉自然流畅
- [ ] 等待感显著降低
- [ ] 过渡语音类别匹配上下文
- [ ] 情绪表达适当

---

## 📝 测试后续步骤

### 测试通过后 ✅

1. **记录测试结果** 到 Phase 2 文档
2. **收集用户反馈** 验证实际体验改进
3. **监控性能指标** 确保稳定性
4. **考虑 Phase 3 优化** (可选)

### 如果遇到问题 ❌

1. **记录问题详情**:
   - 问题描述
   - 复现步骤
   - 控制台日志
   - 预期 vs 实际

2. **参考文档**:
   - `docs/PHASE2_IMPLEMENTATION_STATUS.md`
   - `docs/CONVERSATION_LATENCY_OPTIMIZATION_PLAN.md`

3. **检查代码**:
   - `src/utils/sentenceDetector.ts`
   - `src/utils/ttsQueue.ts`
   - `src/utils/useChatAI.ts`
   - `src/utils/transitionAudio.ts`

---

## 🎯 成功标志

**Phase 2 测试成功** 的标志:

1. ✅ 对话时 **立即** 听到过渡语音 (< 0.5s)
2. ✅ 真实回答 **快速** 开始 (< 2s)
3. ✅ 过渡语音到真实回答 **无缝切换**
4. ✅ 长回答 **流畅播放** (无卡顿)
5. ✅ 对话体验 **显著提升**

**与 Phase 1 对比**:
- Phase 1: 等待 3-5s 后才有声音
- Phase 2: 0.3s 就有反馈,1-2s 听到真实回答

**用户感受**:
- Phase 1: "AI 反应有点慢..."
- Phase 2: "哇,AI 反应好快!" ⭐⭐⭐⭐⭐

---

## 📊 测试数据收集 (可选)

### 延迟数据

测试 10 次,记录平均值:

| 测试轮次 | 过渡语音延迟 | 首句真实回答 | 总延迟 |
|---------|------------|------------|-------|
| 1 | ___ ms | ___ ms | ___ ms |
| 2 | ___ ms | ___ ms | ___ ms |
| 3 | ___ ms | ___ ms | ___ ms |
| ... | ... | ... | ... |
| **平均** | ___ ms | ___ ms | ___ ms |

**目标**:
- 过渡语音: < 500ms
- 首句真实回答: < 2000ms

---

## 🆘 需要帮助?

- **完整实施文档**: `docs/PHASE2_IMPLEMENTATION_STATUS.md`
- **原始计划**: `docs/CONVERSATION_LATENCY_OPTIMIZATION_PLAN.md`
- **Phase 1 状态**: `docs/PHASE1_FINAL_STATUS.md`

---

**更新时间**: 2025-10-22
**状态**: ✅ 就绪 - 可以开始测试
**预计测试时间**: 30 分钟

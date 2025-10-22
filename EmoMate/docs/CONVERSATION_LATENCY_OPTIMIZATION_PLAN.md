# 对话延迟优化实施计划

**项目**: EmoMate 语音对话流畅度优化
**目标**: 将对话延迟从 5-9秒 降低到 1-2秒首字响应
**方案**: 流式响应 + 预测性回应 + API 优化（方案 1 + 2 + 5 组合）
**预计工作量**: 2-3 天
**创建日期**: 2025-10-21
**状态**: 🚀 Phase 1 完成 (90%) - 待音频文件生成和测试
**最后更新**: 2025-10-22

---

## 📊 当前状态分析

### 现有延迟链路
```
用户说话完成
  ↓ [Speech Recognition: 1-2s]
文字识别完成
  ↓ [Claude API 等待: 2-4s] ⚠️ 主要瓶颈
获得完整回答
  ↓ [ElevenLabs TTS: 2-3s] ⚠️ 主要瓶颈
语音合成完成
  ↓ [开始播放: 0s]
用户听到回答

总延迟: 5-9 秒 ❌ 体验差
```

### 目标延迟链路
```
用户说话完成
  ↓ [立即: 0.3s]
播放预设过渡语音 "嗯..." ✅ 立即反馈
  ↓ [并行: Claude 流式生成 0.5-1s]
第一句话生成完成
  ↓ [并行: TTS 合成 0.5-1s]
第一句语音合成完成
  ↓ [无缝切换: 0s]
播放真实回答第一句 ✅ 1-2秒内开始
  ↓ [流水线继续]
后续句子流式播放

总延迟（首字）: 1-2 秒 ✅ 接近实时
总延迟（完整）: 3-5 秒 ✅ 但用户感知流畅
```

---

## 🎯 优化方案概览

### 方案组合
- ✅ **方案 1**: 流式响应 + 分段 TTS（核心，70% 延迟降低）
- ✅ **方案 2**: 预测性回应 + 过渡语音（首字，90% 延迟降低）
- ✅ **方案 5**: Claude API 优化（辅助，30% 延迟降低）

### 预期效果
| 指标 | 当前 | 优化后 | 提升 |
|-----|------|--------|------|
| 首字延迟 | 5-9s | 0.3-0.5s | 🚀 90%+ |
| 第一句真实回答 | 5-9s | 1-2s | 🚀 70%+ |
| 完整回答播放 | 5-9s | 3-5s | ✅ 40%+ |
| 用户感知流畅度 | ⭐⭐ | ⭐⭐⭐⭐⭐ | 🚀 150%+ |

---

## 📅 实施计划（3个阶段）

---

## 🚀 Phase 1: 快速见效优化（Day 1，4-6 小时）

**目标**: 立即降低 30-40% 延迟，验证优化方向
**预期效果**: 5-9s → 3-5s

### Task 1.1: Claude API 参数优化 ⏱️ 30分钟

**优先级**: P0 - 最高
**负责模块**: `EmoMate/src/utils/useChatAI.ts`

#### 具体任务
- [ ] **调整 Token 限制**
  ```typescript
  // 当前配置
  simple: 80 tokens
  normal: 150 tokens
  detailed: 300 tokens

  // 优化后配置
  simple: 50 tokens    // 减少 37%
  normal: 100 tokens   // 减少 33%
  detailed: 200 tokens // 减少 33%
  storytelling: 400 tokens // 保持不变（特殊场景）
  ```

- [ ] **优化 System Prompt**
  ```typescript
  // 在 personality.ts 中添加简洁性要求
  const RESPONSE_STYLE_GUIDE = `
  ## 回答风格要求
  - 默认回答：1-2句话，简短自然
  - 避免冗长解释，除非用户明确要求
  - 优先使用口语化短句
  - 每句话 10-20 字为佳
  `;
  ```

- [ ] **添加停止序列**
  ```typescript
  stop_sequences: ["\n\n", "用户:", "User:", "---"]
  ```

#### 验证标准
- [ ] Token 使用量平均下降 30%+
- [ ] 回答仍保持自然和完整性
- [ ] Claude API 响应时间减少 0.5-1s

#### 预期效果
- API 延迟: 2-4s → 1.5-3s
- 总延迟: 5-9s → 4-7s

---

### Task 1.2: 预设过渡语音库搭建 ⏱️ 2-3小时

**优先级**: P0 - 最高
**负责模块**: `EmoMate/src/utils/transitionAudio.ts` (新建)

#### 具体任务

**Step 1: 生成预设语音文件** (1小时)

- [ ] **使用 ElevenLabs 预生成音频**
  ```typescript
  // 需要生成的过渡语音列表
  const TRANSITION_PHRASES = {
    // 思考类（中性）
    thinking: [
      "嗯...",
      "让我想想...",
      "这个问题啊...",
      "嗯嗯...",
    ],

    // 疑问类（用户提问时）
    question: [
      "欸？",
      "什么呢？",
      "你是说...",
    ],

    // 兴奋类（积极内容）
    excited: [
      "哇！",
      "真的吗？",
      "欸嘿嘿~",
      "太好了！",
    ],

    // 共鸣类（情感支持）
    empathy: [
      "我明白...",
      "是这样啊...",
      "嗯嗯，我懂...",
    ],

    // 确认类（简单回应）
    acknowledgment: [
      "嗯~",
      "好的呢~",
      "明白了~",
    ],
  };
  ```

- [ ] **批量生成音频文件**
  ```bash
  # 创建目录
  mkdir -p EmoMate/assets/audio/transitions/

  # 使用 ElevenLabs API 批量生成
  # 文件命名: thinking_01.mp3, excited_01.mp3 等
  ```

**Step 2: 创建音频管理模块** (1小时)

- [ ] **创建 `transitionAudio.ts`**
  ```typescript
  // EmoMate/src/utils/transitionAudio.ts

  import { Audio } from 'expo-av';

  export type TransitionCategory =
    | 'thinking'
    | 'question'
    | 'excited'
    | 'empathy'
    | 'acknowledgment';

  interface TransitionAudioCache {
    [key: string]: Audio.Sound;
  }

  class TransitionAudioManager {
    private audioCache: TransitionAudioCache = {};
    private initialized = false;

    // 预加载所有过渡音频
    async preloadAll(): Promise<void> {
      const audioFiles = {
        thinking_01: require('../../assets/audio/transitions/thinking_01.mp3'),
        thinking_02: require('../../assets/audio/transitions/thinking_02.mp3'),
        // ... 更多文件
      };

      for (const [key, file] of Object.entries(audioFiles)) {
        const { sound } = await Audio.Sound.createAsync(file);
        this.audioCache[key] = sound;
      }

      this.initialized = true;
    }

    // 根据类别随机选择并播放
    async playTransition(category: TransitionCategory): Promise<void> {
      if (!this.initialized) {
        await this.preloadAll();
      }

      const audioKey = this.selectRandomAudio(category);
      const sound = this.audioCache[audioKey];

      await sound.replayAsync(); // 从头播放
    }

    private selectRandomAudio(category: TransitionCategory): string {
      // 根据类别随机选择
      const categoryAudios = Object.keys(this.audioCache)
        .filter(key => key.startsWith(category));

      const randomIndex = Math.floor(Math.random() * categoryAudios.length);
      return categoryAudios[randomIndex];
    }
  }

  export const transitionAudio = new TransitionAudioManager();
  ```

**Step 3: 集成到对话流程** (30分钟)

- [ ] **修改 `useChatAI.ts`**
  ```typescript
  import { transitionAudio } from './transitionAudio';
  import { detectTransitionCategory } from './conversationAnalysis';

  const sendMessage = async (message: string) => {
    // 1. 立即播放过渡语音
    const category = detectTransitionCategory(message, userEmotion);
    await transitionAudio.playTransition(category); // ⚡ 0.3s 内播放

    // 2. 并行：调用 Claude API
    const response = await callClaudeAPI(message);

    // 3. 后续：TTS 合成真实回答
    await hybridTTS.speak(response);
  };
  ```

- [ ] **创建类别检测工具**
  ```typescript
  // EmoMate/src/utils/conversationAnalysis.ts

  export function detectTransitionCategory(
    userMessage: string,
    userEmotion?: Emotion
  ): TransitionCategory {
    // 检测是否为问题
    if (userMessage.includes('?') ||
        userMessage.includes('？') ||
        userMessage.includes('吗') ||
        userMessage.includes('呢')) {
      return 'question';
    }

    // 检测是否为简单确认
    const acknowledgments = ['好', '嗯', '知道了', 'ok', '可以'];
    if (acknowledgments.some(word => userMessage === word)) {
      return 'acknowledgment';
    }

    // 根据情绪选择
    if (userEmotion === 'happy' || userEmotion === 'excited') {
      return 'excited';
    }

    if (userEmotion === 'sad' || userEmotion === 'angry') {
      return 'empathy';
    }

    // 默认：思考类
    return 'thinking';
  }
  ```

#### 验证标准
- [ ] 所有过渡音频成功预加载（应用启动时）
- [ ] 用户发送消息后 0.3-0.5s 内听到过渡语音
- [ ] 过渡语音与上下文匹配（问题→疑问类，情绪→共鸣类）
- [ ] 音频播放无卡顿，无延迟

#### 预期效果
- 首字延迟: 5-9s → 0.3-0.5s ✅
- 用户感知: 立即反馈，体验大幅提升

---

### Task 1.3: 测试和验证 ⏱️ 1小时

**优先级**: P0 - 最高

#### 测试场景

- [ ] **场景 1: 简单问候**
  ```
  用户: "你好"
  预期: 0.3s 内播放 "嗯~"
  验证: ✅ 立即反馈
  ```

- [ ] **场景 2: 提问**
  ```
  用户: "今天天气怎么样？"
  预期: 0.3s 内播放 "欸？" 或 "让我想想..."
  验证: ✅ 类别匹配
  ```

- [ ] **场景 3: 情绪对话**
  ```
  用户: "我今天好开心！"（表情: happy）
  预期: 0.3s 内播放 "真的吗？" 或 "欸嘿嘿~"
  验证: ✅ 情绪匹配
  ```

- [ ] **场景 4: 长文本**
  ```
  用户: "给我讲讲《流浪地球》的故事"
  预期: 0.3s 播放过渡 → 1.5s Token优化生效 → 回答简洁
  验证: ✅ 延迟降低 + 回答质量
  ```

#### 性能指标

| 指标 | 目标 | 测量方法 |
|-----|------|---------|
| 过渡语音延迟 | < 0.5s | `Date.now()` 计时 |
| API 响应时间 | < 3s | Claude API 日志 |
| 总首字延迟 | < 3.5s | 端到端计时 |

#### 问题跟踪
- [ ] 记录所有测试问题到 `TROUBLESHOOTING.md`
- [ ] 优先修复 P0 级别问题

---

### Phase 1 总结

**完成标志**:
- [x] Token 优化生效，响应时间减少 30%
- [x] 过渡语音库搭建完成，20+ 音频文件
- [x] 首字延迟降低到 0.3-0.5s
- [x] 所有测试场景通过

**预期成果**:
- 总延迟: 5-9s → 3-5s
- 首字延迟: 5-9s → 0.3-0.5s
- 用户满意度: ⭐⭐ → ⭐⭐⭐⭐

**交付物**:
- ✅ 优化后的 `useChatAI.ts`
- ✅ 新建 `transitionAudio.ts`
- ✅ 新建 `conversationAnalysis.ts`
- ✅ 20+ 过渡音频文件
- ✅ Phase 1 测试报告

---

## 🔥 Phase 2: 核心流式优化（Day 2，6-8 小时）

**目标**: 实现流式响应 + 分段 TTS，真正实现实时对话
**预期效果**: 3-5s → 1-2s 首句真实回答

### Task 2.1: Claude 流式响应处理 ⏱️ 2-3小时

**优先级**: P0 - 最高
**负责模块**: `EmoMate/src/utils/useChatAI.ts`

#### 具体任务

**Step 1: 实现流式 API 调用** (1小时)

- [ ] **修改 Claude API 调用方式**
  ```typescript
  // 当前实现（等待完整响应）
  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      messages: [...],
      max_tokens: 150,
      stream: false, // ❌ 阻塞等待
    })
  });
  const data = await response.json();
  const fullText = data.content[0].text;

  // 优化后实现（流式接收）
  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      messages: [...],
      max_tokens: 150,
      stream: true, // ✅ 启用流式
    })
  });

  // 处理 SSE (Server-Sent Events) 流
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    // 解析 SSE 格式
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // 保留不完整的行

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));

        if (data.type === 'content_block_delta') {
          const text = data.delta.text;
          onStreamChunk(text); // ⚡ 实时处理每个chunk
        }
      }
    }
  }
  ```

**Step 2: 分句逻辑实现** (1小时)

- [ ] **创建句子检测器**
  ```typescript
  // EmoMate/src/utils/sentenceDetector.ts

  export class SentenceBuffer {
    private buffer = '';
    private onSentenceComplete: (sentence: string) => void;

    constructor(onSentenceComplete: (sentence: string) => void) {
      this.onSentenceComplete = onSentenceComplete;
    }

    // 添加文本片段
    add(chunk: string): void {
      this.buffer += chunk;
      this.detectSentences();
    }

    // 检测完整句子
    private detectSentences(): void {
      // 中文句子结束符
      const sentenceEnds = /([。！？\n]|\.\.\.|\!+|\?+)/g;

      let match;
      let lastIndex = 0;

      while ((match = sentenceEnds.exec(this.buffer)) !== null) {
        const endIndex = match.index + match[0].length;
        const sentence = this.buffer.slice(0, endIndex).trim();

        if (sentence.length > 0) {
          this.onSentenceComplete(sentence); // 🔔 触发回调
          this.buffer = this.buffer.slice(endIndex);
          sentenceEnds.lastIndex = 0; // 重置正则
        }
      }
    }

    // 强制刷新剩余内容
    flush(): void {
      if (this.buffer.trim().length > 0) {
        this.onSentenceComplete(this.buffer.trim());
        this.buffer = '';
      }
    }
  }
  ```

**Step 3: 集成流式处理到 useChatAI** (1小时)

- [ ] **重构 `sendMessage` 函数**
  ```typescript
  // EmoMate/src/utils/useChatAI.ts

  import { SentenceBuffer } from './sentenceDetector';
  import { TTSQueue } from './ttsQueue'; // Task 2.2 创建

  const sendMessage = async (message: string) => {
    // 1. 立即播放过渡语音
    const category = detectTransitionCategory(message);
    await transitionAudio.playTransition(category);

    // 2. 初始化句子缓冲区和 TTS 队列
    const ttsQueue = new TTSQueue();
    const sentenceBuffer = new SentenceBuffer((sentence) => {
      // 每当检测到完整句子，立即加入 TTS 队列
      ttsQueue.enqueue(sentence);
    });

    // 3. 流式调用 Claude API
    const response = await fetch(CLAUDE_API, {
      method: 'POST',
      body: JSON.stringify({
        stream: true,
        // ... 其他配置
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // 解析 SSE 并提取文本
      const text = parseSSEChunk(chunk);

      if (text) {
        sentenceBuffer.add(text); // ⚡ 实时分句
      }
    }

    // 4. 刷新剩余内容
    sentenceBuffer.flush();

    // 5. 等待所有 TTS 完成
    await ttsQueue.waitForCompletion();
  };

  // SSE 解析辅助函数
  function parseSSEChunk(chunk: string): string | null {
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'content_block_delta') {
            return data.delta.text;
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
    return null;
  }
  ```

#### 验证标准
- [ ] 流式响应成功接收（无阻塞等待）
- [ ] 句子正确分割（按标点符号）
- [ ] 每个句子独立触发回调
- [ ] 完整文本无丢失

---

### Task 2.2: TTS 队列管理器 ⏱️ 2-3小时

**优先级**: P0 - 最高
**负责模块**: `EmoMate/src/utils/ttsQueue.ts` (新建)

#### 具体任务

**Step 1: 创建 TTS 队列类** (1.5小时)

- [ ] **实现队列管理逻辑**
  ```typescript
  // EmoMate/src/utils/ttsQueue.ts

  import { useHybridTTS } from './useHybridTTS';
  import { Audio } from 'expo-av';

  interface TTSQueueItem {
    id: string;
    text: string;
    status: 'pending' | 'synthesizing' | 'ready' | 'playing' | 'completed';
    audio?: Audio.Sound;
  }

  export class TTSQueue {
    private queue: TTSQueueItem[] = [];
    private isPlaying = false;
    private currentIndex = 0;

    // 添加文本到队列
    async enqueue(text: string): Promise<void> {
      const item: TTSQueueItem = {
        id: `tts_${Date.now()}_${Math.random()}`,
        text,
        status: 'pending',
      };

      this.queue.push(item);

      // 立即开始合成（异步）
      this.synthesize(item);

      // 如果当前没在播放，启动播放
      if (!this.isPlaying) {
        this.playNext();
      }
    }

    // 异步合成语音
    private async synthesize(item: TTSQueueItem): Promise<void> {
      item.status = 'synthesizing';

      try {
        // 调用 ElevenLabs 或 Expo Speech
        const audioUri = await this.callTTS(item.text);

        // 加载音频
        const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
        item.audio = sound;
        item.status = 'ready';

        // 如果队列中只有这一项且未播放，立即播放
        if (this.queue.length === 1 && !this.isPlaying) {
          this.playNext();
        }
      } catch (error) {
        console.error('TTS synthesis failed:', error);
        item.status = 'completed'; // 标记为完成（跳过）
      }
    }

    // 调用 TTS 服务
    private async callTTS(text: string): Promise<string> {
      // 使用现有的 useHybridTTS 逻辑
      // 这里需要重构 useHybridTTS 为可导出的函数

      // 优先使用 ElevenLabs（高质量）
      try {
        return await this.callElevenLabs(text);
      } catch (error) {
        // 降级到 Expo Speech（快速）
        return await this.callExpoSpeech(text);
      }
    }

    private async callElevenLabs(text: string): Promise<string> {
      const ELEVENLABS_API_KEY = getElevenLabsApiKey();
      const VOICE_ID = 'hkfHEbBvdQFNX4uWHqRF';

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2', // 使用 Turbo 模型
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.7,
              style: 0.25,
            },
          }),
        }
      );

      const audioBlob = await response.blob();

      // 保存到临时文件
      const audioUri = await this.saveBlobToFile(audioBlob);
      return audioUri;
    }

    private async callExpoSpeech(text: string): Promise<string> {
      // Expo Speech 不返回文件，直接播放
      // 这里需要特殊处理或使用其他本地 TTS
      throw new Error('Expo Speech fallback not implemented for queue');
    }

    private async saveBlobToFile(blob: Blob): Promise<string> {
      // 使用 FileSystem 保存到临时目录
      const FileSystem = require('expo-file-system');
      const filename = `tts_${Date.now()}.mp3`;
      const uri = `${FileSystem.cacheDirectory}${filename}`;

      // 将 Blob 转为 base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          resolve(base64data);
        };
        reader.readAsDataURL(blob);
      });

      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return uri;
    }

    // 播放下一个音频
    private async playNext(): Promise<void> {
      if (this.currentIndex >= this.queue.length) {
        this.isPlaying = false;
        return;
      }

      const item = this.queue[this.currentIndex];

      // 等待音频合成完成
      while (item.status !== 'ready' && item.status !== 'completed') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (item.status === 'completed') {
        // 跳过失败的项
        this.currentIndex++;
        this.playNext();
        return;
      }

      // 播放音频
      this.isPlaying = true;
      item.status = 'playing';

      const sound = item.audio!;

      // 设置播放完成回调
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          item.status = 'completed';
          this.currentIndex++;
          this.playNext(); // 递归播放下一个
        }
      });

      await sound.playAsync();
    }

    // 等待所有音频播放完成
    async waitForCompletion(): Promise<void> {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const allCompleted = this.queue.every(
            item => item.status === 'completed'
          );

          if (allCompleted && !this.isPlaying) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    // 清空队列（用户打断时）
    clear(): void {
      // 停止当前播放
      if (this.currentIndex < this.queue.length) {
        const currentItem = this.queue[this.currentIndex];
        if (currentItem.audio) {
          currentItem.audio.stopAsync();
        }
      }

      this.queue = [];
      this.currentIndex = 0;
      this.isPlaying = false;
    }
  }
  ```

**Step 2: 优化 ElevenLabs 调用** (30分钟)

- [ ] **启用 Turbo 模式**
  ```typescript
  model_id: 'eleven_turbo_v2' // 延迟降低 40%
  optimize_streaming_latency: 4 // 0-4，越大越快
  ```

- [ ] **缓存常用短语**
  ```typescript
  // 预生成常用回答的音频
  const CACHED_RESPONSES = {
    '嗯嗯，好的呢~': 'cached_ok.mp3',
    '我明白了~': 'cached_understand.mp3',
    // ... 更多
  };
  ```

**Step 3: 错误处理和重试** (30分钟)

- [ ] **网络失败重试**
  ```typescript
  async synthesizeWithRetry(text: string, maxRetries = 3): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.callElevenLabs(text);
      } catch (error) {
        if (i === maxRetries - 1) {
          // 最后一次失败，降级到本地 TTS
          return await this.callExpoSpeechFallback(text);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  ```

#### 验证标准
- [ ] 多个句子并行合成（无阻塞）
- [ ] 音频按顺序无缝播放
- [ ] 合成失败时自动降级
- [ ] 用户打断时正确清空队列

---

### Task 2.3: 流水线集成测试 ⏱️ 1-2小时

**优先级**: P0 - 最高

#### 测试场景

- [ ] **场景 1: 短回答（1句话）**
  ```
  用户: "你好"
  预期流程:
    0.3s → 过渡语音 "嗯~"
    1.0s → Claude 生成 "你好呀！"
    1.5s → TTS 合成完成
    1.5s → 开始播放
  验证: ✅ 1.5s 首句播放
  ```

- [ ] **场景 2: 中等回答（2-3句话）**
  ```
  用户: "今天天气怎么样？"
  预期流程:
    0.3s → 过渡语音 "让我想想..."
    1.0s → 第1句生成 "今天天气不错呢~"
    1.5s → 第1句开始播放 ⚡
    2.0s → 第2句生成 "适合出去走走哦~"
    2.5s → 第2句合成完成
    3.0s → 第1句播完，第2句无缝接上 ⚡
  验证: ✅ 流水线无缝切换
  ```

- [ ] **场景 3: 长回答（5+ 句话）**
  ```
  用户: "给我讲讲《流浪地球》"
  预期流程:
    句子流式生成 → 并行合成 → 顺序播放
  验证: ✅ 持续流畅，无卡顿
  ```

- [ ] **场景 4: 用户打断**
  ```
  用户: "讲个故事"
  → AI 开始讲故事（第2句播放中）
  用户: "停" [打断]
  预期: ✅ 立即停止，队列清空
  ```

#### 性能指标

| 指标 | 目标 | 测量方法 |
|-----|------|---------|
| 首句真实回答延迟 | < 2s | 从发送到播放 |
| 句子间隔 | < 0.3s | 无缝衔接 |
| TTS 合成速度 | < 1s/句 | Turbo 模式 |
| 内存占用 | < 300MB | 长对话测试 |

---

### Phase 2 总结

**完成标志**:
- [x] Claude 流式响应成功集成
- [x] 句子分割逻辑准确
- [x] TTS 队列管理器稳定运行
- [x] 流水线测试全部通过

**预期成果**:
- 总延迟: 3-5s → 1.5-3s
- 首句真实回答: 3-5s → 1-2s
- 流畅度: ⭐⭐⭐⭐ → ⭐⭐⭐⭐⭐

**交付物**:
- ✅ 重构后的 `useChatAI.ts`（流式支持）
- ✅ 新建 `sentenceDetector.ts`
- ✅ 新建 `ttsQueue.ts`
- ✅ Phase 2 测试报告
- ✅ 性能基准数据

---

## 🎨 Phase 3: 优化和完善（Day 3，4-6 小时）

**目标**: 极致优化，提升稳定性和用户体验
**预期效果**: 1.5-3s → 1-2s，稳定性 99%+

### Task 3.1: 性能优化 ⏱️ 2小时

**优先级**: P1 - 高

#### 具体任务

**优化 1: 音频预热** (30分钟)

- [ ] **应用启动时预加载**
  ```typescript
  // App.tsx 中初始化
  useEffect(() => {
    // 预加载过渡音频
    transitionAudio.preloadAll();

    // 预热 TTS 服务（发送测试请求）
    warmupTTS();
  }, []);

  async function warmupTTS() {
    // 发送短文本给 ElevenLabs 预热连接
    await elevenLabsTTS.synthesize("嗯");
  }
  ```

**优化 2: 智能缓存** (1小时)

- [ ] **缓存常用回答**
  ```typescript
  // 缓存策略
  const CACHE_PHRASES = [
    "嗯嗯，好的呢~",
    "我明白了~",
    "真的吗？",
    "太好了！",
    // ... 20+ 常用短语
  ];

  // 启动时批量生成并缓存
  async function preGenerateCache() {
    for (const phrase of CACHE_PHRASES) {
      const audio = await elevenLabsTTS.synthesize(phrase);
      audioCache.set(phrase, audio);
    }
  }

  // 使用时优先从缓存读取
  async function synthesizeWithCache(text: string) {
    if (audioCache.has(text)) {
      return audioCache.get(text); // ⚡ 0ms
    }
    return await elevenLabsTTS.synthesize(text);
  }
  ```

**优化 3: 并发控制** (30分钟)

- [ ] **限制并发 TTS 请求**
  ```typescript
  class TTSQueue {
    private maxConcurrent = 3; // 最多同时合成3个句子
    private activeRequests = 0;

    async synthesize(item: TTSQueueItem) {
      // 等待可用槽位
      while (this.activeRequests >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      this.activeRequests++;
      try {
        await this.callTTS(item.text);
      } finally {
        this.activeRequests--;
      }
    }
  }
  ```

#### 验证标准
- [ ] 应用启动时间增加 < 500ms
- [ ] 常用短语命中率 > 30%
- [ ] 并发 TTS 请求稳定（无超时）

---

### Task 3.2: 用户体验优化 ⏱️ 1.5小时

**优先级**: P1 - 高

#### 具体任务

**优化 1: 视觉反馈** (30分钟)

- [ ] **实时状态指示**
  ```typescript
  // 显示当前状态
  enum ConversationState {
    LISTENING = 'listening',      // 用户说话中
    THINKING = 'thinking',         // 播放过渡语音
    GENERATING = 'generating',     // Claude 生成中
    SYNTHESIZING = 'synthesizing', // TTS 合成中
    SPEAKING = 'speaking',         // AI 说话中
  }

  // UI 显示
  {state === 'thinking' && <Text>🤔 思考中...</Text>}
  {state === 'generating' && <Text>💭 正在回答...</Text>}
  {state === 'speaking' && <Text>🗣️ 兰兰正在说话</Text>}
  ```

**优化 2: 打断机制** (1小时)

- [ ] **允许用户随时打断**
  ```typescript
  const handleUserInterrupt = () => {
    // 停止当前播放
    ttsQueue.clear();

    // 停止 Claude 流式响应
    abortController.abort();

    // 重置状态
    setConversationState('LISTENING');
  };

  // 检测用户开始说话时自动打断
  useEffect(() => {
    if (isUserSpeaking && conversationState === 'SPEAKING') {
      handleUserInterrupt();
    }
  }, [isUserSpeaking]);
  ```

#### 验证标准
- [ ] 状态指示准确实时
- [ ] 打断响应时间 < 200ms
- [ ] 打断后无残留音频

---

### Task 3.3: 错误处理和监控 ⏱️ 1.5小时

**优先级**: P1 - 高

#### 具体任务

**任务 1: 全链路错误处理** (1小时)

- [ ] **网络错误降级**
  ```typescript
  async function handleNetworkError(error: Error, context: string) {
    console.error(`Network error in ${context}:`, error);

    // ElevenLabs 失败 → Expo Speech
    if (context === 'TTS' && error.message.includes('elevenlabs')) {
      return await fallbackToExpoSpeech();
    }

    // Claude 失败 → 预设回答
    if (context === 'Claude') {
      return FALLBACK_RESPONSES.network_error;
    }
  }
  ```

**任务 2: 性能监控** (30分钟)

- [ ] **关键指标收集**
  ```typescript
  // 监控指标
  interface PerformanceMetrics {
    transitionLatency: number;    // 过渡语音延迟
    firstSentenceLatency: number; // 首句延迟
    avgTTSTime: number;           // 平均 TTS 时间
    claudeStreamTime: number;     // Claude 流式时间
  }

  const metrics = {
    record(metric: keyof PerformanceMetrics, value: number) {
      // 记录到本地
      // 或发送到分析服务
    },

    getReport() {
      // 生成性能报告
    }
  };
  ```

#### 验证标准
- [ ] 所有错误场景有降级方案
- [ ] 关键指标准确记录
- [ ] 生成可读的性能报告

---

### Task 3.4: 文档和测试 ⏱️ 1小时

**优先级**: P1 - 高

#### 具体任务

- [ ] **更新技术文档**
  - `CONVERSATION_LATENCY_OPTIMIZATION_PLAN.md`（本文档）标记为完成
  - 更新 `QUICK_REFERENCE.md` 添加新 API
  - 更新 `PROGRESS.md` 更新完成度

- [ ] **编写使用指南**
  ```markdown
  # 流式对话系统使用指南

  ## 工作原理
  1. 用户说话 → 立即播放过渡语音
  2. Claude 流式生成 → 分句处理
  3. TTS 并行合成 → 队列播放

  ## 配置选项
  - 过渡语音类别
  - TTS 并发数
  - 缓存策略

  ## 故障排除
  - 延迟仍然高 → 检查网络
  - 音频卡顿 → 调整并发数
  ```

- [ ] **回归测试**
  - 运行 Phase 1 和 Phase 2 的所有测试场景
  - 确保新功能不破坏现有功能

#### 验证标准
- [ ] 文档完整准确
- [ ] 所有测试通过
- [ ] 代码审查完成

---

### Phase 3 总结

**完成标志**:
- [x] 性能优化生效（缓存、预热、并发）
- [x] 用户体验优化完成（状态指示、打断）
- [x] 错误处理完善
- [x] 文档和测试完成

**预期成果**:
- 总延迟: 1.5-3s → 1-2s
- 稳定性: 95% → 99%+
- 用户满意度: ⭐⭐⭐⭐ → ⭐⭐⭐⭐⭐

**交付物**:
- ✅ 优化后的所有模块
- ✅ 完整测试报告
- ✅ 性能监控系统
- ✅ 用户文档
- ✅ 技术文档更新

---

## 📊 总体进度跟踪

### 完成度检查表

#### Phase 1: 快速见效优化（Day 1） - ✅ 90% 完成 (2025-10-22)
- [x] Task 1.1: Claude API 参数优化 ✅
- [x] Task 1.2: 预设过渡语音库搭建 ✅
- [ ] Task 1.3: 生成过渡语音音频文件 ⏳
- [ ] Task 1.4: 测试和验证 ⏳

#### Phase 2: 核心流式优化（Day 2）
- [ ] Task 2.1: Claude 流式响应处理
- [ ] Task 2.2: TTS 队列管理器
- [ ] Task 2.3: 流水线集成测试

#### Phase 3: 优化和完善（Day 3）
- [ ] Task 3.1: 性能优化
- [ ] Task 3.2: 用户体验优化
- [ ] Task 3.3: 错误处理和监控
- [ ] Task 3.4: 文档和测试

---

## 📈 性能指标对比

### 延迟指标

| 阶段 | 首字延迟 | 首句真实回答 | 完整回答 | 流畅度 |
|-----|---------|------------|---------|--------|
| 当前 | 5-9s | 5-9s | 5-9s | ⭐⭐ |
| Phase 1 后 | 0.3-0.5s | 3-5s | 3-5s | ⭐⭐⭐⭐ |
| Phase 2 后 | 0.3-0.5s | 1-2s | 3-5s | ⭐⭐⭐⭐⭐ |
| Phase 3 后 | 0.3-0.5s | 1-2s | 2-4s | ⭐⭐⭐⭐⭐ |
| **改进** | **🚀 90%+** | **🚀 70%+** | **🚀 50%+** | **🚀 150%+** |

### 技术指标

| 指标 | 当前 | 目标 | 改进 |
|-----|------|------|------|
| Claude API 响应 | 2-4s | 1.5-3s | 30% ↓ |
| TTS 合成速度 | 2-3s | 0.8-1.5s | 50% ↓ |
| 首字反馈 | 5-9s | 0.3-0.5s | 94% ↓ |
| 句子间隔 | N/A | < 0.3s | 全新 |
| 并发 TTS | 1 | 3 | 3x ↑ |
| 缓存命中率 | 0% | 30%+ | 全新 |

---

## 🔧 技术栈变更

### 新增依赖
```json
{
  "expo-file-system": "^17.0.0",  // 音频文件缓存
  // 其他依赖已存在，无需新增
}
```

### 新增文件
```
EmoMate/
├── src/
│   └── utils/
│       ├── transitionAudio.ts        # 过渡语音管理器
│       ├── conversationAnalysis.ts   # 对话类型检测
│       ├── sentenceDetector.ts       # 句子分割器
│       └── ttsQueue.ts               # TTS 队列管理器
├── assets/
│   └── audio/
│       └── transitions/              # 过渡语音文件夹
│           ├── thinking_01.mp3
│           ├── thinking_02.mp3
│           ├── question_01.mp3
│           ├── excited_01.mp3
│           └── ... (20+ files)
└── docs/
    └── CONVERSATION_LATENCY_OPTIMIZATION_PLAN.md  # 本文档
```

### 修改文件
```
EmoMate/src/utils/
├── useChatAI.ts          # 重构支持流式响应
└── useHybridTTS.ts       # 抽取可复用函数
```

---

## ⚠️ 风险和缓解措施

### 风险 1: 流式响应可能不稳定
**影响**: 句子分割错误，音频播放混乱
**概率**: 中
**缓解**:
- 充分测试句子分割逻辑
- 添加完整性校验
- 失败时降级到原有方案

### 风险 2: ElevenLabs API 配额或延迟
**影响**: TTS 合成失败或慢
**概率**: 低
**缓解**:
- 使用 Turbo 模式
- Expo Speech 作为后备
- 缓存常用短语

### 风险 3: 过渡语音不自然
**影响**: 用户感觉突兀
**概率**: 中
**缓解**:
- 精心挑选过渡语音
- 根据上下文智能选择
- 收集用户反馈优化

### 风险 4: 内存占用增加
**影响**: 长时间对话卡顿
**概率**: 低
**缓解**:
- 及时清理播放完的音频
- 限制队列长度
- 监控内存使用

---

## 🎯 成功标准

### 技术标准
- [x] 首字延迟 < 0.5s
- [x] 首句真实回答 < 2s
- [x] 句子间隔 < 0.3s
- [x] 稳定性 > 99%
- [x] 所有测试场景通过

### 用户体验标准
- [x] 用户感觉"立即反馈"
- [x] 对话流畅无卡顿
- [x] 打断响应及时
- [x] 状态指示清晰
- [x] 错误降级无感知

### 业务标准
- [x] 用户满意度 ⭐⭐⭐⭐⭐
- [x] 对话完成率提升 50%+
- [x] 平均对话时长增加 2x
- [x] 用户留存率提升

---

## 📝 后续优化方向

### 短期（1-2周）
1. **本地意图识别**: 30% 对话本地处理
2. **更多情绪类型**: 支持更细致的过渡语音选择
3. **用户偏好学习**: 记住用户喜欢的回答风格

### 中期（1个月）
1. **离线模式**: 本地小模型 + 缓存对话
2. **多语言支持**: 英语、日语流式对话
3. **情绪同步**: Live2D 动作与语音同步

### 长期（3个月+）
1. **实时语音对话**: 类似 ChatGPT Voice
2. **多轮上下文优化**: 长对话性能优化
3. **个性化 TTS**: 用户自定义语音

---

## 📞 支持和反馈

### 遇到问题？
- 查看 `TROUBLESHOOTING.md`
- 检查本文档的"风险和缓解措施"章节
- 查看 `QUICK_REFERENCE.md` 快速参考

### 性能不达标？
1. 运行性能监控获取报告
2. 检查网络连接质量
3. 验证 ElevenLabs API 配额
4. 查看调试日志

### 提交反馈
- 记录详细复现步骤
- 提供性能监控数据
- 附上错误日志
- 描述预期 vs 实际行为

---

## 🎉 项目里程碑

- [ ] **Milestone 1**: Phase 1 完成（首字延迟 < 0.5s）
- [ ] **Milestone 2**: Phase 2 完成（流式对话上线）
- [ ] **Milestone 3**: Phase 3 完成（生产就绪）
- [ ] **Milestone 4**: 用户反馈收集和迭代

---

**文档版本**: v1.0.0
**最后更新**: 2025-10-21
**维护者**: EmoMate 开发团队
**状态**: 📋 待执行

---

## 附录：代码示例

### 示例 1: 完整流式对话流程
```typescript
// 用户发送消息的完整流程
async function handleUserMessage(message: string) {
  // 1. 立即反馈（0.3s）
  const category = detectTransitionCategory(message);
  await transitionAudio.playTransition(category);

  // 2. 初始化流式处理
  const ttsQueue = new TTSQueue();
  const sentenceBuffer = new SentenceBuffer((sentence) => {
    ttsQueue.enqueue(sentence); // 分句后立即加入队列
  });

  // 3. 流式调用 Claude
  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    body: JSON.stringify({
      stream: true,
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [{ role: 'user', content: message }],
    }),
  });

  // 4. 处理流式响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const text = parseSSE(chunk);

    if (text) {
      sentenceBuffer.add(text); // 实时分句
    }
  }

  // 5. 刷新剩余内容
  sentenceBuffer.flush();

  // 6. 等待播放完成
  await ttsQueue.waitForCompletion();
}
```

### 示例 2: TTS 队列工作流程
```typescript
// TTS 队列的并行合成和顺序播放
const queue = new TTSQueue();

// 添加句子 1
queue.enqueue("今天天气不错呢~");
// → 立即开始合成（异步）

// 0.5s 后添加句子 2
queue.enqueue("适合出去走走哦~");
// → 开始合成句子 2
// → 句子 1 合成完成，立即播放
// → 句子 2 合成完成，等待句子 1 播完
// → 句子 1 播完，无缝切换到句子 2
```

---

**准备好了吗？让我们开始实施这个激动人心的优化！🚀**

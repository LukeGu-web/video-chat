# 过渡语音音频文件生成指南

**目的**: 生成 20 个过渡语音音频文件用于 Phase 1 优化
**工作量**: 30-60 分钟
**日期**: 2025-10-22

---

## 📋 需要生成的文件清单

### 完整文件列表 (20 个)

| 类别 | 文件名 | 文本内容 | 用途 |
|------|--------|---------|------|
| **思考类** | thinking_01.mp3 | "嗯..." | 中性回应 |
| | thinking_02.mp3 | "让我想想..." | 思考状态 |
| | thinking_03.mp3 | "这个问题啊..." | 接收问题 |
| | thinking_04.mp3 | "嗯嗯..." | 确认倾听 |
| **疑问类** | question_01.mp3 | "欸？" | 表示疑问 |
| | question_02.mp3 | "什么呢？" | 询问详情 |
| | question_03.mp3 | "你是说..." | 确认理解 |
| **兴奋类** | excited_01.mp3 | "哇！" | 惊喜反应 |
| | excited_02.mp3 | "真的吗？" | 兴奋询问 |
| | excited_03.mp3 | "欸嘿嘿~" | 害羞开心 |
| | excited_04.mp3 | "太好了！" | 庆祝高兴 |
| **共鸣类** | empathy_01.mp3 | "我明白..." | 理解安慰 |
| | empathy_02.mp3 | "是这样啊..." | 认同倾听 |
| | empathy_03.mp3 | "嗯嗯，我懂..." | 深度共鸣 |
| **确认类** | acknowledgment_01.mp3 | "嗯~" | 简单确认 |
| | acknowledgment_02.mp3 | "好的呢~" | 同意回应 |
| | acknowledgment_03.mp3 | "明白了~" | 理解确认 |

---

## 🎯 语音参数设置

### ElevenLabs 配置

- **Voice ID**: `hkfHEbBvdQFNX4uWHqRF` (兰兰专用语音)
- **Model**: `eleven_multilingual_v2` (多语言模型)
- **语音设置**:
  - Stability: `0.4` (自然变化)
  - Similarity Boost: `0.7` (保持特征)
  - Style: `0.25` (温柔风格)
  - Speaker Boost: `true` (启用)

---

## 🚀 生成方法

### 方法 1: 自动批量生成 (推荐)

#### 步骤 1: 准备环境

```bash
# 确认在 EmoMate 目录
cd /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate

# 确认 .env 文件中有 ELEVENLABS_API_KEY
cat .env | grep ELEVENLABS_API_KEY
```

#### 步骤 2: 运行生成脚本

```bash
# 运行批量生成脚本
node scripts/generate_transition_audio.js
```

**脚本功能**:
- ✅ 自动创建 `assets/audio/transitions/` 目录
- ✅ 批量调用 ElevenLabs API 生成 20 个音频文件
- ✅ 自动跳过已存在的文件
- ✅ 防止 API 限流 (每个文件间隔 500ms)
- ✅ 显示生成进度和统计信息

**预期输出**:
```
🎵 开始批量生成过渡语音音频文件...

📁 创建目录: assets/audio/transitions

📊 总共需要生成 20 个音频文件

--- 类别: thinking (4 个文件) ---
生成: "嗯..." -> thinking_01.mp3
✅ 成功: thinking_01.mp3
生成: "让我想想..." -> thinking_02.mp3
✅ 成功: thinking_02.mp3
...

==================================================
📊 生成完成统计:
   ✅ 成功: 20/20
   ❌ 失败: 0/20
   📁 输出目录: assets/audio/transitions
==================================================

🎉 所有音频文件生成成功!

下一步: 在 transitionAudio.ts 中取消注释音频加载代码
```

#### 步骤 3: 验证生成结果

```bash
# 查看生成的文件
ls -lh assets/audio/transitions/

# 应该看到 20 个 .mp3 文件
```

---

### 方法 2: 手动生成 (备选)

如果自动脚本失败,可以手动生成:

#### 1. 访问 ElevenLabs

- URL: https://elevenlabs.io/
- 登录账号

#### 2. 选择语音

- 在 Voices 中找到 Voice ID `hkfHEbBvdQFNX4uWHqRF`
- 或使用兰兰的专用语音

#### 3. 设置参数

在语音设置中调整:
- **Stability**: 0.4
- **Similarity Boost**: 0.7
- **Style**: 0.25

#### 4. 逐个生成

对照上面的文件清单,逐个输入文本并生成:

1. 输入文本 (如 "嗯...")
2. 点击 **Generate**
3. 点击 **Download** 保存为对应文件名 (如 `thinking_01.mp3`)
4. 移动文件到 `EmoMate/assets/audio/transitions/` 目录
5. 重复 20 次

---

## 🔧 生成后的集成步骤

### 步骤 1: 取消注释 transitionAudio.ts 中的代码

打开 `src/utils/transitionAudio.ts`,找到以下注释块:

```typescript
// TODO: Phase 1 待实现 - 生成音频文件后取消注释
```

**需要取消注释的代码**:

1. **在 `preloadAll()` 方法中** (约第 80-110 行):
   ```typescript
   const audioFiles = {
     thinking_01: require('../../assets/audio/transitions/thinking_01.mp3'),
     thinking_02: require('../../assets/audio/transitions/thinking_02.mp3'),
     // ... 其他文件
   };

   for (const [key, file] of Object.entries(audioFiles)) {
     const { sound } = await Audio.Sound.createAsync(file);
     this.audioCache[key] = sound;
   }
   ```

2. **在 `playTransition()` 方法中** (约第 130-145 行):
   ```typescript
   if (!this.initialized) {
     console.warn('[TransitionAudio] 音频未预加载,跳过播放');
     return;
   }

   const audioKey = this.selectRandomAudio(category);
   const sound = this.audioCache[audioKey];

   if (!sound) {
     console.warn(`[TransitionAudio] 未找到音频: ${audioKey}`);
     return;
   }

   try {
     await sound.replayAsync(); // 从头播放
   } catch (error) {
     console.error('[TransitionAudio] 播放失败:', error);
   }
   ```

### 步骤 2: 在 App.tsx 中预加载音频

在应用启动时预加载过渡语音:

```typescript
// App.tsx
import { transitionAudio } from './src/utils/transitionAudio';

useEffect(() => {
  // 预加载过渡音频
  transitionAudio.preloadAll();
}, []);
```

### 步骤 3: 测试播放

运行应用并发送消息,观察控制台日志:

```
[TransitionAudio] 开始预加载过渡语音...
[TransitionAudio] 预加载完成！
[TransitionAudio] 播放过渡语音 [thinking]: "嗯..."
```

---

## ⚠️ 常见问题

### Q1: API Key 错误

**错误**: `❌ 错误: 未找到 ELEVENLABS_API_KEY 环境变量`

**解决**:
```bash
# 检查 .env 文件
cat .env

# 确保包含:
ELEVENLABS_API_KEY=your_actual_api_key
```

### Q2: API 限流

**错误**: `API 错误 (429): Rate limit exceeded`

**解决**: 脚本已内置 500ms 延迟,如果仍然遇到限流:
- 增加延迟时间 (修改 `delay(500)` 为 `delay(1000)`)
- 或分批生成 (先注释掉部分类别)

### Q3: 网络错误

**错误**: `fetch failed` 或 `ECONNREFUSED`

**解决**:
- 检查网络连接
- 确认可以访问 https://api.elevenlabs.io
- 使用 VPN (如果在受限网络环境)

### Q4: 音频文件过大

**问题**: 音频文件体积较大影响应用包大小

**解决**:
- 当前使用 `mp3_44100_128` 格式,质量和大小平衡
- 如需更小体积,可修改为 `mp3_22050_32`
- 20 个文件预计总大小: 100-200 KB (可接受)

---

## 📊 成本估算

### ElevenLabs API 使用

- **每个音频**: 约 10-20 字符
- **总字符数**: 20 文件 × 15 字符 = 300 字符
- **免费额度**: 10,000 字符/月
- **成本**: **免费** (远低于免费额度)

---

## ✅ 验证清单

生成完成后检查:

- [ ] 20 个 .mp3 文件已生成
- [ ] 文件位于 `assets/audio/transitions/` 目录
- [ ] 每个文件大小 > 0 KB (5-20 KB 为正常)
- [ ] transitionAudio.ts 代码已取消注释
- [ ] App.tsx 已添加预加载代码
- [ ] 应用启动时成功预加载 (查看日志)
- [ ] 发送消息时能播放过渡语音 (查看日志)

---

## 🎉 下一步

生成完成后:

1. ✅ 标记 Task 1.3 为完成
2. ▶️ 进入 Task 1.4: 测试和验证
3. 📊 测试 4 个场景并记录性能指标
4. 📝 生成 Phase 1 完整测试报告

---

**文档版本**: v1.0.0
**创建时间**: 2025-10-22
**维护者**: EmoMate 开发团队

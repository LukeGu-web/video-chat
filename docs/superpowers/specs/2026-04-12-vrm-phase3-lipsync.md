# Phase 3 — 口型同步

**日期**: 2026-04-12
**前置条件**: Phase 2 验证通过
**目标**: 兰兰说话时嘴巴跟着音频实时同步，使用 wawa-lipsync 驱动 VRM 口型 Blend Shape

---

## 核心问题

wawa-lipsync 需要在浏览器（WebView）内捕获音频信号才能分析口型。

当前架构中，TTS 音频由 ElevenLabs 生成后通过 `TTSQueue` 调用 `expo-av` 在 React Native 侧播放，WebView 无法访问这个音频流。

**解决方案**：将音频播放职责从 expo-av 迁移到 WebView，以 base64 编码通过 bridge 传输音频数据。

---

## 音频路由变更

### 现有流程

```
ElevenLabs API → AudioCache（本地文件）→ TTSQueue → expo-av.playAsync()
```

### 新流程

```
ElevenLabs API → AudioCache（本地文件）→ TTSQueue
                                              ↓
                               读取文件 → base64 编码
                                              ↓
                               bridge: playAudio 消息
                                              ↓
                          WebView 创建 Audio 元素播放
                                              ↓
                          wawa-lipsync 捕获 → VRM 口型
                                              ↓
                          播放完毕 → bridge: audioComplete
                                              ↓
                               TTSQueue 播放下一条
```

---

## Bridge 消息协议

### EmoMate → WebView

**播放音频（触发口型同步）**

```typescript
{
  type: 'playAudio',
  data: {
    audioBase64: string,   // base64 编码的音频数据
    mimeType: string,      // 'audio/mpeg' | 'audio/mp4' | 'audio/wav'
    id: string             // 唯一 ID，用于匹配 audioComplete 回调
  }
}
```

**停止当前音频**

```typescript
{ type: 'stopAudio' }
```

### WebView → EmoMate

**音频播放完毕**

```typescript
{
  type: 'audioComplete',
  data: { id: string }    // 对应 playAudio 的 id
}
```

**口型开始/结束（可选，用于调试）**

```typescript
{ type: 'lipSyncStart' }
{ type: 'lipSyncEnd' }
```

---

## character/ 侧实现

### 新增依赖

```
wawa-lipsync
```

### AudioPlayer.tsx

WebView 内的音频播放组件，职责：

- 监听 bridge `playAudio` 消息
- 创建 `Audio` 元素，设置 base64 data URL 作为 src
- 播放完成后发送 `audioComplete` 消息
- 暴露 AudioContext sourceNode 给 LipSyncController

### LipSyncController.tsx

口型同步控制组件，职责：

- 接收 AudioPlayer 的 sourceNode
- 使用 wawa-lipsync 分析音频，输出 viseme 数据
- 将 viseme 映射到 VRM 口型 Blend Shape（A/E/I/O/U）
- 通过 `useFrame` 每帧更新 VRM blend shape weight

### Viseme → VRM 口型映射

wawa-lipsync 输出 viseme 代码，映射到 VRM blend shape：

| Viseme | VRM Blend Shape |
|--------|----------------|
| PP, FF | `u` (0.4) |
| TH, DD, kk, CH, SS, nn, RR | `e` (0.5) |
| aa | `a` (1.0) |
| E | `e` (0.8) |
| I | `i` (0.7) |
| O | `o` (0.8) |
| U | `u` (0.7) |
| sil（静音） | 所有口型归零 |

---

## EmoMate/ 侧修改

### TTSQueue.ts

**修改播放逻辑**：

```typescript
// 原来
await audioPlayer.playAsync()

// 改为
const audioBase64 = await FileSystem.readAsStringAsync(filePath, {
  encoding: FileSystem.EncodingType.Base64
})
webViewRef.postMessage({
  type: 'playAudio',
  data: { audioBase64, mimeType: 'audio/mpeg', id: uniqueId }
})
// 等待 audioComplete 消息再继续队列
```

**等待机制**：TTSQueue 现有的顺序播放逻辑（一条播完再播下一条）通过等待 `audioComplete` bridge 消息来触发，与现有队列机制兼容。

### HiyoriWebView.tsx（或新命名 VRMAvatarWebView.tsx）

新增 `audioComplete` 消息处理器，通知 TTSQueue 当前音频已播放完毕。

---

## 性能考虑

- ElevenLabs 生成的音频文件通常 10~100KB，base64 编码后约增大 33%
- 传输延迟：bridge 消息传输 < 5ms，可忽略
- wawa-lipsync 在浏览器内纯 JavaScript 运行，无需网络请求，延迟 < 1 帧

---

## 验证标准

Phase 3 完成的判定条件：

- [ ] 兰兰说话时嘴巴实时跟着动，口型与音频节奏匹配
- [ ] 说话结束后嘴巴自然闭合（sil 状态）
- [ ] TTSQueue 顺序播放不受影响（一句说完接下一句）
- [ ] 口型与表情叠加正确（说话时可同时有开心表情）
- [ ] 不说话时（idle 状态）嘴巴保持闭合
- [ ] 手动停止（stopAudio）后口型立即归零

---

## 不在本阶段做

- AI 生成骨骼参数（Phase 4）
- 音频音量控制（已在现有 WebView GainNode 方案中处理）

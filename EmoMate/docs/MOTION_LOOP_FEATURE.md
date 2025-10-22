# Hiyori动作循环播放功能文档

## 版本信息

- **版本**: v1.2.1
- **最后更新**: 2025-10-22
- **新增功能**: 持续动作循环播放

## 功能概述

### 问题描述

在原有系统中,所有动作都只播放一次然后结束。这对于`Speaking`和`Thinking`等持续性动作来说不合理:

**例如**:
```
用户问: "什么是量子力学?"
AI思考并回答(持续10秒)

原有行为:
  1. Thinking动作播放1次(3秒)
  2. 动作结束,角色变为Idle
  3. AI还在说话,但角色已经静止 ❌

期望行为:
  1. Thinking动作开始循环播放
  2. 在AI思考期间持续Thinking
  3. 开始Speaking时切换到Speaking循环
  4. 说完后自然返回Idle ✅
```

### 解决方案

实现**智能动作循环系统**:
- 识别持续性动作(`Speaking`, `Thinking`)
- 自动启用循环播放
- 在动作切换时停止循环
- 清理定时器防止内存泄漏

---

## 实现细节

### 1. 循环判断逻辑

```typescript
// 判断动作是否应该循环播放
const shouldLoopMotion = (motionName: string): boolean => {
  const continuousMotions = ['Speaking', 'Thinking'];
  return continuousMotions.includes(motionName);
};
```

**持续性动作**:
- `Speaking` - AI说话时应持续播放
- `Thinking` - AI思考时应持续播放

**非持续性动作**:
- `Wave` - 挥手一次即可
- `Dance` - 跳舞一次即可
- `Happy`, `Surprised` 等情绪动作 - 展示一次即可

### 2. 循环播放实现

```typescript
// 播放动作并启用循环
playLive2DMotion(motionName, enableLoop);

// enableLoop = true:
// 1. 立即播放一次动作
// 2. 设置interval每3秒重复播放
// 3. 直到动作改变或组件卸载

// enableLoop = false:
// 1. 播放一次动作
// 2. 3秒后标记为完成
// 3. 触发onMotionComplete回调
```

### 3. 循环管理

```typescript
// 启动循环
motionLoopIntervalRef.current = setInterval(() => {
  if (webViewRef.current?.hiyoriBridge && lastMotionRef.current === motionName) {
    console.log(`🔄 [Live2DCharacter] Loop replay: ${motionName}`);
    webViewRef.current.hiyoriBridge.playMotion(motionName);
  }
}, 3000); // 每3秒重播一次

// 停止循环
const stopMotionLoop = () => {
  if (motionLoopIntervalRef.current) {
    clearInterval(motionLoopIntervalRef.current);
    motionLoopIntervalRef.current = null;
  }
};

// 清理(组件卸载时)
useEffect(() => {
  return () => {
    if (motionLoopIntervalRef.current) {
      clearInterval(motionLoopIntervalRef.current);
    }
  };
}, []);
```

---

## 使用场景

### 场景1: AI思考问题

```typescript
// 用户: "你能解释一下相对论吗?"

流程:
1. 用户提问 → AI Status: Thinking
2. Live2DCharacter检测到Thinking
3. shouldLoopMotion('Thinking') → true
4. 启动Thinking动作循环播放

控制台输出:
🎯 [EmotionAwareCharacter] Motion selected: Thinking
   📝 Reason: AI is thinking
   ⭐ Priority: 3
🎭 [Live2DCharacter] Playing motion: Thinking (loop enabled)
▶️ [Live2DCharacter] Starting motion: Thinking
🔁 [Live2DCharacter] Starting motion loop for: Thinking
🔄 [Live2DCharacter] Loop replay: Thinking (每3秒)
🔄 [Live2DCharacter] Loop replay: Thinking
...

5. AI开始回答 → AI Status: Speaking
6. 动作切换到Speaking
7. 停止Thinking循环,启动Speaking循环

控制台输出:
🔀 [Live2DCharacter] Motion changed to: Speaking
🔄 [Live2DCharacter] Stopped motion loop
🎭 [Live2DCharacter] Playing motion: Speaking (loop enabled)
🔁 [Live2DCharacter] Starting motion loop for: Speaking
🔄 [Live2DCharacter] Loop replay: Speaking (每3秒)
...

8. AI说完 → AI Status: Idle
9. 停止Speaking循环,返回Idle

控制台输出:
🔀 [Live2DCharacter] Motion changed to: Idle
🔄 [Live2DCharacter] Stopped motion loop
🎭 [Live2DCharacter] Playing motion: Idle
```

### 场景2: 庆祝动作(非循环)

```typescript
// 用户: "我考试通过了!"
// AI: "太棒了！我们庆祝一下吧!"

流程:
1. 检测到庆祝场景
2. 选择Dance动作
3. shouldLoopMotion('Dance') → false
4. 播放一次Dance(不循环)
5. 3秒后完成,自动返回Idle

控制台输出:
🎯 [EmotionAwareCharacter] Motion selected: Dance
   📝 Reason: Celebration detected
   ⭐ Priority: 4
🎭 [Live2DCharacter] Playing motion: Dance
▶️ [Live2DCharacter] Starting motion: Dance
✅ [Live2DCharacter] Motion completed: Dance
🔀 [Live2DCharacter] Motion changed to: Idle
```

---

## 日志系统

### 日志格式

所有日志使用emoji前缀便于识别:

| Emoji | 含义 | 示例 |
|-------|------|------|
| 🎯 | 动作选择 | `Motion selected: Speaking` |
| 🎭 | 动作播放 | `Playing motion: Thinking (loop enabled)` |
| ▶️ | 动作开始 | `Starting motion: Speaking` |
| 🔁 | 循环启动 | `Starting motion loop for: Thinking` |
| 🔄 | 循环重播 | `Loop replay: Speaking` |
| 🔀 | 动作切换 | `Motion changed to: Happy` |
| ✅ | 动作完成 | `Motion completed: Wave` |
| ⏭️ | 跳过重复 | `Motion already playing, skipping` |
| ⚠️ | 警告信息 | `Cannot play motion - model not ready` |
| ✨ | 模型就绪 | `Hiyori model is ready!` |
| 🧹 | 清理资源 | `Cleaned up timers and loops` |

### 日志示例

**完整对话流程**:
```
用户问: "什么是量子力学?"

[EmotionAwareCharacter]
🎯 Motion selected: Thinking
   📝 Reason: AI is thinking
   ⭐ Priority: 3
   🎭 Emotion: neutral | AI Status: Thinking

[Live2DCharacter]
🔀 Motion changed to: Thinking
🎭 Playing motion: Thinking (loop enabled)
▶️ Starting motion: Thinking
🔁 Starting motion loop for: Thinking
🔄 Loop replay: Thinking
🔄 Loop replay: Thinking
🔄 Loop replay: Thinking

[AI开始回答]
[EmotionAwareCharacter]
🎯 Motion selected: Speaking
   📝 Reason: AI is speaking
   ⭐ Priority: 3
   🎭 Emotion: neutral | AI Status: Speaking

[Live2DCharacter]
🔀 Motion changed to: Speaking
🔄 Stopped motion loop
🎭 Playing motion: Speaking (loop enabled)
🔁 Starting motion loop for: Speaking
🔄 Loop replay: Speaking
🔄 Loop replay: Speaking
...

[AI说完]
[Live2DCharacter]
🔀 Motion changed to: Idle
🔄 Stopped motion loop
🎭 Playing motion: Idle
▶️ Starting motion: Idle
```

---

## 性能考虑

### 循环间隔

```typescript
// 当前设置: 每3秒重播一次
motionLoopIntervalRef.current = setInterval(() => {
  webViewRef.current.hiyoriBridge.playMotion(motionName);
}, 3000);
```

**为什么是3秒?**
- Hiyori单个动作播放时长约2-3秒
- 3秒间隔确保动作播放完整不重叠
- 视觉上连贯流畅,不会显得卡顿

**可以调整吗?**
- 可以,但不建议<2秒(动作未完成就重播)
- 也不建议>5秒(会有明显停顿)

### 内存管理

```typescript
// 确保清理所有定时器
useEffect(() => {
  return () => {
    // 清理超时定时器
    if (motionTimeoutRef.current) {
      clearTimeout(motionTimeoutRef.current);
    }
    // 清理循环interval
    if (motionLoopIntervalRef.current) {
      clearInterval(motionLoopIntervalRef.current);
    }
  };
}, []);
```

**防止内存泄漏**:
- ✅ 组件卸载时清理所有定时器
- ✅ 动作切换时停止之前的循环
- ✅ 使用useRef存储interval ID避免闭包问题

### CPU使用

**优化点**:
1. **防止重复启动**: 检查相同动作是否已在循环中
2. **条件执行**: 只在需要时启动循环
3. **及时停止**: 动作改变时立即停止循环

```typescript
// 防止重复启动循环
if (lastMotionRef.current === motionName && enableLoop && motionLoopIntervalRef.current) {
  console.log(`🔄 Motion ${motionName} already looping, continuing`);
  return; // 不重复启动
}
```

---

## 扩展指南

### 添加新的持续性动作

如果未来需要让其他动作也循环播放:

```typescript
// 编辑 Live2DCharacter.tsx
const shouldLoopMotion = useCallback((motionName: string): boolean => {
  const continuousMotions = [
    'Speaking',
    'Thinking',
    'Dance',      // 新增: 让Dance也循环播放
    'Excited'     // 新增: 让Excited也循环播放
  ];
  return continuousMotions.includes(motionName);
}, []);
```

### 自定义循环间隔

```typescript
// 不同动作使用不同的循环间隔
const getLoopInterval = (motionName: string): number => {
  const intervals: Record<string, number> = {
    'Speaking': 3000,   // 说话: 3秒
    'Thinking': 4000,   // 思考: 4秒(更慢更沉思)
    'Dance': 5000,      // 跳舞: 5秒(让动作更完整)
  };
  return intervals[motionName] || 3000;
};

// 使用
motionLoopIntervalRef.current = setInterval(() => {
  webViewRef.current.hiyoriBridge.playMotion(motionName);
}, getLoopInterval(motionName));
```

---

## 故障排除

### 问题1: 循环没有停止

**现象**: 动作切换后还在播放之前的动作

**原因**: interval没有正确清理

**解决方案**:
```typescript
// 检查console日志
// 应该看到: 🔄 Stopped motion loop

// 如果没有,检查stopMotionLoop是否被调用
// 确保在useEffect cleanup中调用:
return () => {
  if (currentMotion !== lastMotionRef.current) {
    stopMotionLoop();
  }
};
```

### 问题2: 动作播放太频繁

**现象**: 角色动作看起来很卡,不流畅

**原因**: 循环间隔太短

**解决方案**:
```typescript
// 增加间隔时间
setInterval(() => {
  // ...
}, 4000); // 从3000改为4000
```

### 问题3: 动作延迟太久

**现象**: 角色停顿很久才开始下一个动作

**原因**: 循环间隔太长

**解决方案**:
```typescript
// 减少间隔时间
setInterval(() => {
  // ...
}, 2500); // 从3000改为2500
```

---

## 测试建议

### 手动测试步骤

1. **测试Speaking循环**:
   ```
   - 与AI对话
   - 观察Speaking动作是否持续播放
   - 检查console是否有"Loop replay: Speaking"
   - 确认AI说完后返回Idle
   ```

2. **测试Thinking循环**:
   ```
   - 问AI复杂问题
   - 观察Thinking动作是否循环
   - 确认开始回答时切换到Speaking
   ```

3. **测试非循环动作**:
   ```
   - 触发Wave/Dance/Happy等动作
   - 确认只播放一次
   - 确认3秒后返回Idle
   ```

4. **测试动作切换**:
   ```
   - 快速切换情绪(happy→sad→surprised)
   - 确认动作正确切换
   - 检查console没有错误
   - 确认之前的循环已停止
   ```

### Console日志检查清单

- [ ] 看到动作选择日志 (🎯)
- [ ] 看到动作播放日志 (🎭)
- [ ] Speaking/Thinking有"loop enabled"标记
- [ ] 看到循环启动日志 (🔁)
- [ ] 看到循环重播日志 (🔄, 每3秒)
- [ ] 动作切换时看到停止循环日志
- [ ] 组件卸载时看到清理日志 (🧹)
- [ ] 没有错误或警告信息

---

## 相关文档

- **HIYORI_MOTION_OPTIMIZATION.md**: 动作系统架构
- **OPTIMIZATION_SUMMARY.md**: 优化总览
- **HIYORI_INTEGRATION.md**: Hiyori集成指南

---

## 版本历史

### v1.2.1 (2025-10-22)
- ✅ 实现持续动作循环播放系统
- ✅ 添加详细的console日志
- ✅ 自动管理循环启动和停止
- ✅ 防止内存泄漏的清理机制

---

**状态**: ✅ 已实现并可用

**建议**: 在实际使用中观察循环间隔是否合适,如有需要可微调3000ms的值。

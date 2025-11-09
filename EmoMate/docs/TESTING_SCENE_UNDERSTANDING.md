# 场景理解系统测试指南

**版本**: v1.0
**创建日期**: 2025-01-09
**适用范围**: Step 5.1 (场景上下文注入) + Step 5.2 (视觉问答)

---

## 📋 测试前提条件

### 1. 环境配置检查

确认`.env`文件中包含必需的API密钥：

```bash
# .env 文件示例
CLAUDE_API_KEY=sk-ant-api03-...
ELEVENLABS_API_KEY=...
```

**验证方法**:
```bash
# 检查环境变量是否正确加载
npm start
# 观察终端是否有API密钥缺失的错误
```

### 2. 应用启动

```bash
# 启动开发服务器
npm start

# 在Expo Go中打开应用
# 扫描二维码或按 i (iOS) / a (Android)
```

### 3. 权限授予

确保应用已获得必要权限：
- ✅ 相机权限 (用于场景分析和表情检测)
- ✅ 麦克风权限 (用于语音对话)

---

## 🧪 Step 5.1 测试: 场景上下文注入

### 功能说明
Step 5.1使AI能够感知用户的视觉环境，并在对话中自然地提及和响应场景信息。

### 测试场景 A: 自动场景感知

**目标**: 验证AI能否自然地感知并提及用户环境

**步骤**:
1. 启动应用，进入HomeScreen
2. 等待BasicEmotionDetector自动捕获画面（每30秒一次）
3. 观察控制台日志，确认帧捕获成功：
   ```
   [BasicEmotionDetector] 📸 Frame captured (30s interval)
   ```
4. 用户说一句普通的话（不包含视觉关键词），例如：
   - "今天心情不错"
   - "你好呀"
   - "最近在学习"

**预期结果**:
- ✅ AI的回复**不会**主动提及场景（因为用户没有询问视觉信息）
- ✅ AI回复正常，符合兰兰人格
- ✅ 控制台没有场景分析的日志

**成功标准**:
- AI能正常对话
- 场景数据保持待命状态（未触发分析）

---

### 测试场景 B: 手动触发场景分析

**目标**: 验证视觉关键词能否触发场景分析

**步骤**:
1. 确保已经有至少一次帧捕获（等待30秒）
2. 使用包含视觉关键词的问题，例如：
   - **"看"**: "你能看见我吗？"
   - **"周围"**: "我周围有什么？"
   - **"这是什么"**: "这是什么地方？"
   - **"环境"**: "现在什么环境？"

**预期控制台日志**:
```
[HomeScreen] 🎯 Visual keyword detected: "看"
[HomeScreen] 🔍 Starting visual analysis...
[useVisualQA] 🎯 Visual keyword detected: "看" in "你能看见我吗？"
[useVisualQA] 🔍 Starting scene analysis for visual question
[claudeVision] 📸 Starting scene analysis...
[claudeVision] ✅ Scene analysis complete
[useVisualQA] ✅ Scene analysis complete
```

**预期AI回复示例**:
```
✅ 正确: "是的呢，我可以通过摄像头看见你~看起来你在[场景描述]呢~"
✅ 正确: "嗯嗯，我能看到你哦~你现在是在[环境]吗？"
❌ 错误: "我是AI，没有视觉能力" (说明场景分析未生效)
```

**成功标准**:
- ✅ 检测到视觉关键词
- ✅ 触发场景分析API调用
- ✅ 更新`currentScene`状态
- ✅ AI回复包含场景信息

---

### 测试场景 C: 场景上下文融入对话

**目标**: 验证场景信息能否正确传递给AI

**步骤**:
1. 先触发一次场景分析（使用"你能看见我吗？"）
2. 等待场景分析完成（观察日志`✅ Scene analysis complete`）
3. 接着进行正常对话，例如：
   - "你觉得这个地方怎么样？"
   - "给我一些建议吧"
   - "我应该做什么？"

**预期结果**:
- ✅ AI能够结合场景信息给出建议
- ✅ 例如在咖啡馆 → "在咖啡馆学习要加油哦~"
- ✅ 例如在卧室 → "在房间里休息一下也不错呢~"

**成功标准**:
- AI的回复自然融入场景信息
- 不会机械地列举场景物品
- 符合兰兰的温柔人格

---

### 测试场景 D: 场景时效性

**目标**: 验证30分钟过期机制

**步骤**:
1. 触发一次场景分析
2. 修改系统时间（或等待30分钟）
3. 再次进行对话

**预期结果**:
- ✅ 如果场景数据过期，AI不会使用旧场景信息
- ✅ `isSceneDataFresh()`返回false
- ✅ `buildScenePrompt()`返回空字符串

**验证代码**:
```typescript
// 在控制台查看
const { currentScene } = useUserStore.getState();
console.log('Scene timestamp:', currentScene?.timestamp);
console.log('Age (minutes):', (Date.now() - currentScene?.timestamp) / 60000);
console.log('Is fresh?:', isSceneDataFresh(currentScene, 30));
```

---

## 🧪 Step 5.2 测试: 视觉问答

### 功能说明
Step 5.2使用户能够直接询问视觉内容，AI会自动触发场景分析并回答。

### 测试场景 E: 直接视觉问题

**目标**: 验证视觉问答的完整流程

**步骤**:
1. 等待至少一次帧捕获（30秒）
2. 直接问视觉问题（使用12个关键词之一）：

**测试问题集**:
```
1. "这是什么？"
2. "这是什么书？"
3. "这本书你知道吗？"
4. "周围有什么？"
5. "我周围有什么东西？"
6. "看到了什么？"
7. "你看见了什么？"
8. "现在什么环境？"
9. "这是哪里？"
10. "帮我看看这个"
11. "认识这个吗？"
12. "知道这是什么吗？"
```

**预期控制台日志**:
```
[HomeScreen] 🎯 Visual question detected, scene analysis triggered
[useVisualQA] 🎯 Visual keyword detected: "这是什么" in "这本书你知道吗？"
[useVisualQA] 🔍 Starting scene analysis for visual question
[claudeVision] 📸 Analyzing scene with user question: "这本书你知道吗？"
[claudeVision] ✅ Detected objects: ["book: Deep Learning by Ian Goodfellow", ...]
[useVisualQA] ✅ Scene analysis complete
```

**预期AI回复示例**:
```
✅ 正确: "当然知道!《深度学习》是Ian Goodfellow的经典作品,你在学机器学习吗?"
✅ 正确: "看到笔记本电脑、咖啡杯,还有几本书呢~在忙什么呀?"
✅ 正确: "看起来是咖啡馆,光线柔和,挺适合学习的呢~"
❌ 错误: "根据场景分析显示..." (机械化语言)
❌ 错误: "我看不见" (说明分析失败)
```

**成功标准**:
- ✅ 检测到视觉关键词
- ✅ 自动触发场景分析（在AI回复之前）
- ✅ AI使用场景信息回答问题
- ✅ 回答自然亲切，符合兰兰人格

---

### 测试场景 F: 连续视觉问答

**目标**: 验证场景缓存和复用机制

**步骤**:
1. 问第一个视觉问题: "这是什么书？"
2. 等待回复
3. 立即问第二个问题: "这本书讲什么？"
4. 观察是否复用场景数据

**预期结果**:
- ✅ 第一个问题触发场景分析
- ✅ 第二个问题**复用**已有场景数据（如果在30分钟内）
- ✅ 控制台只显示一次`📸 Starting scene analysis`

**性能优化验证**:
- 第二次问答响应更快（无需重新分析）
- 节省API调用成本

---

### 测试场景 G: 无图片时的优雅降级

**目标**: 验证没有图片时的处理

**步骤**:
1. 刚启动应用，未捕获任何帧（<30秒）
2. 立即问视觉问题: "你能看见我吗？"

**预期控制台日志**:
```
[useVisualQA] 🎯 Visual keyword detected: "看见" in "你能看见我吗？"
[useVisualQA] ⚠️ Visual keyword detected but no image available for analysis
```

**预期AI回复示例**:
```
✅ 正确: "嗯…等一下下,我还在准备呢~"
✅ 正确: "稍等哦,我马上就能看到你了~"
❌ 错误: (崩溃或无响应)
```

**成功标准**:
- ✅ 检测到关键词但不崩溃
- ✅ 返回true表示检测到视觉问题
- ✅ AI给出合理的等待回复

---

## 📊 测试检查清单

### Step 5.1 - 场景上下文注入
- [ ] 普通对话不触发场景分析
- [ ] 视觉关键词触发分析
- [ ] 场景信息正确传递给AI
- [ ] AI自然融入场景描述
- [ ] 30分钟过期机制生效
- [ ] `buildScenePrompt()`格式正确
- [ ] `isSceneDataFresh()`判断准确

### Step 5.2 - 视觉问答
- [ ] 12个视觉关键词全部能触发
- [ ] 场景分析在AI回复前完成
- [ ] AI使用场景数据回答问题
- [ ] 回答自然且符合人格
- [ ] 连续问答复用场景数据
- [ ] 无图片时优雅降级
- [ ] `processUserInput()`正确返回boolean

---

## 🔍 调试方法

### 查看场景数据

在Chrome DevTools Console中运行：

```javascript
// 1. 查看当前场景数据
const { currentScene } = useUserStore.getState();
console.log('Current Scene:', currentScene);

// 2. 查看场景新鲜度
import { isSceneDataFresh } from './utils/buildScenePrompt';
console.log('Is Fresh?:', isSceneDataFresh(currentScene, 30));

// 3. 查看场景提示文本
import { buildScenePrompt } from './utils/buildScenePrompt';
console.log('Scene Prompt:', buildScenePrompt(currentScene));

// 4. 查看聊天历史
const { chatHistory } = useUserStore.getState();
console.log('Chat History:', chatHistory);
```

### 控制台日志过滤

使用浏览器控制台过滤器查看关键日志：

```
过滤器: [VisualQA]     # 查看视觉问答日志
过滤器: [HomeScreen]   # 查看主屏幕日志
过滤器: [claudeVision] # 查看场景分析日志
过滤器: 🎯            # 查看关键词检测
过滤器: ✅            # 查看成功完成事件
过滤器: ❌            # 查看错误事件
```

### 常见问题排查

#### 问题1: 视觉关键词未触发场景分析

**症状**: 说了"这是什么"但没有触发分析

**检查**:
1. 确认`lastCapturedFrameRef.current`有值
2. 检查`detectVisualKeywords()`是否返回关键词
3. 查看`useVisualQA`的`enabled`是否为true

**解决**:
```typescript
// 在HomeScreen.tsx中添加调试日志
console.log('Last frame available?:', !!lastCapturedFrameRef.current);
```

#### 问题2: AI未使用场景信息

**症状**: 场景分析成功但AI回复中没有场景信息

**检查**:
1. 确认`currentScene`已更新
2. 检查`isSceneDataFresh()`是否返回true
3. 确认`buildScenePrompt()`返回非空字符串

**解决**:
```typescript
// 在useChatAI.ts中添加调试日志
console.log('Scene Prompt:', scenePrompt);
console.log('Context Prompt:', contextPrompt);
```

#### 问题3: 场景数据未保存

**症状**: 场景分析完成但`currentScene`为null

**检查**:
1. 确认`setCurrentScene()`被调用
2. 检查`response.success`和`response.scene`
3. 查看是否有错误阻止状态更新

**解决**:
```typescript
// 在useVisualQA.ts中添加日志
console.log('Setting scene:', response.scene);
setCurrentScene(response.scene);
console.log('Scene set successfully');
```

---

## 🎯 成功标准总结

### Step 5.1 成功标准
- ✅ 场景分析只在必要时触发
- ✅ 场景信息自然融入对话
- ✅ 时效性机制正常工作
- ✅ 不影响正常对话流程

### Step 5.2 成功标准
- ✅ 视觉关键词100%检测率
- ✅ 场景分析自动触发
- ✅ AI准确回答视觉问题
- ✅ 回复自然符合人格
- ✅ 优雅处理边界情况

---

## 📝 测试报告模板

```markdown
# 场景理解系统测试报告

**测试日期**: YYYY-MM-DD
**测试人**: [姓名]
**应用版本**: v1.0.0

## Step 5.1 测试结果
- [ ] 场景 A: 自动场景感知 - PASS/FAIL
- [ ] 场景 B: 手动触发分析 - PASS/FAIL
- [ ] 场景 C: 场景上下文融入 - PASS/FAIL
- [ ] 场景 D: 场景时效性 - PASS/FAIL

## Step 5.2 测试结果
- [ ] 场景 E: 直接视觉问答 - PASS/FAIL
- [ ] 场景 F: 连续视觉问答 - PASS/FAIL
- [ ] 场景 G: 无图片降级 - PASS/FAIL

## 发现的问题
1. [描述问题]
2. [描述问题]

## 改进建议
1. [建议内容]
2. [建议内容]

## 总体评分
- 功能完整性: ___ / 10
- 用户体验: ___ / 10
- 性能表现: ___ / 10
```

---

**文档版本**: v1.0
**最后更新**: 2025-01-09
**维护者**: EmoMate Team

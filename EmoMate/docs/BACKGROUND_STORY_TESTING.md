# 背景故事系统测试指南

## 📝 功能概述

背景故事系统已成功集成到EmoMate应用中，为AI对话提供动态背景场景和情境化故事。

### ✅ 已完成的集成

1. **配置系统** (`src/config/backgroundScenes.ts`)
   - 24个预配置场景（基于现有图片）
   - 支持天气变体扩展
   - 故事模板系统
   - 智能场景选择逻辑

2. **背景管理** (`src/hooks/useBackgroundContext.ts`)
   - 自动场景选择（基于时间和日期）
   - 30分钟自动刷新
   - 错误处理和恢复

3. **AI集成** (`src/utils/useChatAI.ts`)
   - 背景故事添加到系统消息
   - AI可以引用背景情境进行对话

4. **UI集成** (`src/screens/HomeScreen.tsx`)
   - 动态背景图片切换
   - 加载状态显示
   - 调试信息面板（仅开发模式）

## 🧪 测试步骤

### 1. 启动应用（正常模式）

```bash
cd EmoMate
npm start
```

**预期行为**：
- ✅ App启动时自动生成背景场景
- ✅ 根据当前时间选择合适的背景图片
- ✅ 背景图片平滑加载显示

### 2. 启动应用（调试模式）

```bash
cd EmoMate
SHOW_TEST_COMPONENTS=true npm start
```

**预期行为**：
- ✅ 显示背景场景调试信息面板（左上角）
- ✅ 面板显示：场景ID、类型、地点、天气、故事摘要
- ✅ 可以验证场景选择是否正确

**调试面板示例**：
```
背景场景调试信息
场景ID: everyday_morning_bedroom
类型: everyday - morning
地点: bedroom
天气: default
故事: 今天早上7点醒来，躺在床上看着窗外的阳光...
```

### 3. 测试背景图片切换

**测试场景**：
- 早晨（6:00-9:00）：应显示卧室/上学路/教室早晨场景
- 中午（9:00-14:00）：应显示教室/食堂/天台场景
- 下午（14:00-18:00）：应显示图书馆/美术室/操场场景
- 傍晚（18:00-20:00）：应显示回家路/客厅/卧室场景
- 夜晚（20:00-24:00）：应显示夜晚卧室/阳台场景

**修改系统时间测试**：
```typescript
// 临时测试：在useBackgroundContext.ts中修改时间
const now = new Date();
now.setHours(14); // 测试下午场景
```

### 4. 测试AI对话中的背景引用

**测试对话**：

```
用户: "你现在在哪里？"
预期: AI会根据背景故事回答，例如"我现在在教室里呢，下午的阳光透过窗户照进来"

用户: "你刚才在做什么？"
预期: AI会引用背景故事，例如"刚才在图书馆看书，现在正准备..."

用户: "外面天气怎么样？"
预期: AI会根据天气信息回答，例如"今天天气还不错，阳光明媚呢~"
```

### 5. 测试周末和假期场景

**修改日期测试**：
```typescript
// 在backgroundStory.ts的getCurrentWeather函数中
const now = new Date();
now.setDay(0); // 周日 -> 应切换到weekend场景
```

**预期场景**：
- 周末白天：咖啡厅、公园、街道
- 周末夜晚：夜市、夜景街道
- 假期：海滩、度假街道

### 6. 测试自动刷新功能

**测试步骤**：
1. 启动应用并记录初始场景ID
2. 等待30分钟（或修改代码缩短刷新时间）
3. 验证背景是否自动刷新

**快速测试修改**：
```typescript
// 在useBackgroundContext.ts中将30分钟改为1分钟
if (context && shouldRefreshBackground(context.timestamp)) {
  // 刷新逻辑
}

// 在backgroundStory.ts中修改阈值
export function shouldRefreshBackground(lastTimestamp: Date): boolean {
  const diffMinutes = (now.getTime() - lastTimestamp.getTime()) / (1000 * 60);
  return diffMinutes >= 1; // 从30改为1分钟
}
```

## 🐛 常见问题排查

### 问题1: 背景图片不显示

**可能原因**：
- 图片路径错误
- 图片文件不存在
- require()映射未更新

**解决方案**：
```typescript
// 检查 backgroundStory.ts 中的 getBackgroundImageSource 函数
// 确保所有图片路径都正确映射
const pathMap: Record<string, any> = {
  'everyday/morning/bedroom.jpeg': require('../../assets/background/everyday/morning/bedroom.jpeg'),
  // ... 确保所有路径都存在
};
```

### 问题2: 场景选择不正确

**检查**：
- 验证`timeRange`配置是否正确
- 检查优先级设置
- 查看控制台日志

**调试**：
```typescript
// 在 generateBackgroundContext 中添加日志
console.log('Scene selection:', {
  dayType,
  currentHour,
  selectedScene: scene?.id,
});
```

### 问题3: AI不引用背景故事

**检查**：
- 确认`formatStoryForAI`是否被调用
- 验证背景故事是否传递到`sendMessage`
- 检查Claude API系统消息

**调试**：
```typescript
// 在 runAIFlow 中添加日志
console.log('Background story:', backgroundStory);
```

### 问题4: 应用启动时卡在加载

**可能原因**：
- 背景生成失败
- 图片加载超时

**解决方案**：
- 检查错误日志
- 验证fallback逻辑
- 确保所有必需的图片都存在

## 📊 验证清单

完成以下检查以确保系统正常工作：

- [ ] ✅ 应用启动时正确加载背景
- [ ] ✅ 调试模式下显示场景信息
- [ ] ✅ 背景图片根据时间自动选择
- [ ] ✅ AI对话中能引用背景故事
- [ ] ✅ 周末和平日场景正确区分
- [ ] ✅ 背景每30分钟自动刷新
- [ ] ✅ 错误处理正常工作（显示fallback）
- [ ] ✅ 性能良好（无明显卡顿）

## 🎯 性能指标

**目标性能**：
- 背景初始化时间: < 500ms
- 图片加载时间: < 1000ms
- 故事生成时间: < 100ms
- 内存占用: 不超过基线+5MB

**监控方法**：
```typescript
// 在 useBackgroundContext 中添加计时
const start = Date.now();
const newContext = await generateBackgroundContext();
console.log(`Background init took ${Date.now() - start}ms`);
```

## 🚀 下一步扩展

### 1. 添加天气变体

**步骤**：
1. 为关键场景添加天气图片（如`bedroom_rainy.jpeg`）
2. 集成天气API
3. 更新`getCurrentWeather`函数

### 2. 添加更多场景

**步骤**：
1. 将新图片放入相应文件夹
2. 在`SCENE_CONFIG`添加配置
3. （可选）添加故事模板

### 3. 个性化场景

**想法**：
- 根据用户喜好选择场景
- 记忆用户最喜欢的场景
- 季节性场景切换

## 📝 开发注意事项

### 添加新场景时

1. **图片命名规范**：
   - 使用小写字母
   - 使用下划线分隔
   - 天气变体使用后缀（`_rainy`, `_sunny`）

2. **配置要求**：
   - 必须设置`timeRange`
   - 建议设置`priority`
   - 添加相关`tags`

3. **测试要求**：
   - 验证图片正确显示
   - 检查时间范围是否合理
   - 测试故事生成

### 调试技巧

1. **使用调试模式**：
   ```bash
   SHOW_TEST_COMPONENTS=true npm start
   ```

2. **查看控制台日志**：
   - `[BackgroundContext]` 前缀 - 背景系统日志
   - `[ChatAI]` 前缀 - AI集成日志

3. **临时修改时间**：
   ```typescript
   // 快速测试不同时间段
   const testHour = 14; // 下午
   const scene = getSceneForContext(dayType, testHour);
   ```

## 🎉 成功标准

系统集成成功的标志：

1. ✅ 启动时自动加载合适的背景
2. ✅ 背景图片清晰显示无错误
3. ✅ AI对话自然引用背景信息
4. ✅ 调试信息准确完整
5. ✅ 性能满足目标指标
6. ✅ 错误处理优雅降级

## 📚 相关文档

- **配置系统**: `src/config/backgroundScenes.ts`
- **使用指南**: `src/config/BACKGROUND_SCENES_GUIDE.md`
- **使用示例**: `src/utils/BACKGROUND_STORY_USAGE.md`
- **Hook实现**: `src/hooks/useBackgroundContext.ts`
- **AI集成**: `src/utils/useChatAI.ts`

---

**准备好测试了吗？** 🚀

按照上述步骤开始测试，有问题随时查阅相关文档或日志！

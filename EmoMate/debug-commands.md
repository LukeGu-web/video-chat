# Debug Commands for Module Resolution Issue

## 现在请按以下步骤进行调试：

### 1. 启动调试版本
```bash
cd EmoMate
npx expo start --clear
```

### 2. 观察Metro输出
查看终端中的详细日志，特别关注：
- `[Metro] Loading dependency graph...`
- `[Metro] Bundle build started`
- 任何模块解析错误

### 3. 检查调试组件
在应用中应该看到三个调试组件：
- `MinimalEmotionDetector`（最小组件）
- `TestVisionCamera`（VisionCamera测试）  
- `TestWorklets`（Worklets测试）

点击每个组件的测试按钮，观察：
- 哪个模块导入失败
- 具体的错误信息
- 控制台日志

### 4. Metro Bundle分析
如果仍有问题，运行：
```bash
npx expo export --dev
```
然后检查输出的bundle文件中是否包含模块"1337"

### 5. 版本降级测试
如果问题确定在worklets或reanimated，运行：
```bash
npm install react-native-reanimated@3.16.1
npm install react-native-worklets-core@1.4.0
npx expo start --clear
```

### 6. 重新安装依赖
```bash
rm -rf node_modules package-lock.json
npm install
npx expo start --clear
```

## 预期结果
- 如果所有调试组件正常显示并且测试通过，说明基础依赖OK
- 如果某个测试失败，日志会显示具体的导入错误
- 如果仍然显示"module 1337"错误，说明是Metro bundler的缓存或配置问题
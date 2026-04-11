# Phase 1 — VRM 渲染基础

**日期**: 2026-04-12
**目标**: 用 Three.js + React Three Fiber + three-vrm 替换 PIXI.js + Live2D，在 WebView 中渲染 VRM 角色模型

---

## 背景

当前 `character/` 使用 PIXI.js + pixi-live2d-display-mulmotion 渲染 Hiyori Live2D 模型。本阶段完全替换渲染层，迁移到 VRM 格式，为后续的表情、口型、AI 驱动动作打下基础。

---

## 范围

### 涉及文件（character/）

| 文件 | 操作 |
|------|------|
| `app/components/HiyoriLive2D.tsx` | 删除，替换为 `VRMAvatar.tsx` |
| `app/routes/_index.tsx` | 更新：引用新组件 |
| `app/root.tsx` | 移除 Live2D script 标签（cubism core / live2d.js） |
| `public/assets/vrm/` | 新建目录，存放 `.vrm` 模型文件 |
| `package.json` | 依赖变更（见下方） |

### 依赖变更

**移除：**
```
pixi.js
pixi-live2d-display-mulmotion
```

**新增：**
```
three
@react-three/fiber
@react-three/drei
@pixiv/three-vrm
```

---

## 组件设计

### VRMAvatar.tsx

```typescript
interface VRMAvatarProps {
  modelPath: string       // VRM 文件路径，如 '/assets/vrm/girl_c.vrm'
  width?: number
  height?: number
}

interface VRMAvatarRef {
  isReady: () => boolean
  getVRM: () => VRM | null
}
```

**初始化流程：**
```
1. React Three Fiber Canvas 挂载
2. useLoader(GLTFLoader) 加载 .vrm 文件，使用 VRMLoaderPlugin 解析
3. VRM 加载完成 → 居中定位，设置合适缩放
4. 启动 useFrame 循环 → 每帧调用 vrm.update(delta)
5. 向 React Native 发送 vrmReady 消息
```

**渲染设置：**
- Canvas 背景透明（alpha: true）
- 抗锯齿开启
- 相机位置：正面视角，显示上半身
- 环境光 + 方向光（模仿当前 Live2D 效果）

### Bridge 消息（本阶段新增）

**WebView → EmoMate：**
```typescript
{ type: 'vrmReady', data: { modelName: string } }
{ type: 'initError', data: { error: string } }
```

**EmoMate → WebView（本阶段支持）：**
```typescript
{ type: 'ping' }  // 检查连接
```

### _index.tsx 更新

```typescript
// 移除 HiyoriLive2D 引用
// 添加：
import VRMAvatar from '~/components/VRMAvatar'

// Canvas 包裹 VRMAvatar，透明背景
```

---

## VRM 模型文件

**模型**: School Uniform Girls - Summer / Girl C
**来源**: VRoid Hub（已确认许可：商业使用 ✅，修改 ✅）
**存放路径**: `character/public/assets/vrm/girl_c.vrm`

模型文件需在实现前手动下载放置。

---

## 验证标准

Phase 1 完成的判定条件：

- [ ] `npm run dev` 启动无报错
- [ ] 浏览器打开 `http://localhost:5174/` 能看到 Girl C 角色
- [ ] 角色透明背景正确显示（无白色/黑色底）
- [ ] 角色居中显示，比例正常（上半身可见）
- [ ] React Native WebView 收到 `vrmReady` 消息
- [ ] 控制台无 WebGL 错误

---

## 不在本阶段做

- 表情控制
- 骨骼动画
- 口型同步
- AI 驱动
- 物理模拟（Spring Bone 可在渲染后验证是否自动工作）

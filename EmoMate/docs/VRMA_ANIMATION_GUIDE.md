# VRMA 动画制作指南

本文档记录如何从 Mixamo 制作自定义 `.vrma` 动画文件，并集成到项目中。

---

## 工具准备

| 工具 | 说明 | 获取方式 |
|------|------|---------|
| Blender | 3D 编辑器，免费 | https://www.blender.org |
| VRM Add-on for Blender | VRM/VRMA 导入导出插件（Saturday06） | GitHub: saturday06/VRM-Addon-for-Blender |
| Rokoko 插件 | 骨骼重定向插件，免费 | Blender → Edit → Preferences → Add-ons → 搜索 Rokoko |
| Mixamo | Adobe 动捕动画库，免费账号 | https://www.mixamo.com |

---

## 完整制作流程

### Step 1：安装 Blender 插件

1. 下载 VRM Add-on for Blender（`.zip` 文件）
2. Blender → `Edit` → `Preferences` → `Add-ons` → `Install`，选择 zip 安装
3. 同样方式搜索并启用 **Rokoko** 插件

---

### Step 2：从 Mixamo 下载动画

1. 登录 mixamo.com，选择目标动画
2. 下载设置：
   - Format: **FBX**
   - Skin: **Without Skin**（只要骨骼，不要模型）
3. 下载 `.fbx` 文件

---

### Step 3：在 Blender 中导入 VRM 模型

```
File → Import → VRM (.vrm)
```

选择角色 VRM 文件（如 `lanlan.vrm`），导入后角色以 T-Pose 出现。

---

### Step 4：导入 Mixamo FBX 动画

```
File → Import → FBX (.fbx)
```

导入后，右上角 **Outliner（场景集合）** 中出现两个 Armature：

- **Armature** — VRM 模型骨架（骨骼名：`hips`、`spine`、`head` 等）
- **Armature.001** — Mixamo 骨架（骨骼名：`mixamorig:Hips`、`mixamorig:Spine` 等）

> 区分方法：点击 Armature 旁的 ▶ 展开，查看骨骼名称前缀

---

### Step 5：使用 Rokoko 插件重定向骨骼

#### 打开 Rokoko 面板

- 鼠标移入 3D 视口，按 `N` 键打开侧边栏
- 点击顶部 **`Rokoko`** 标签，向下找到 **`Retargeting`** 区域

#### 设置 Source 和 Target

```
Source Armature:  Armature.001   （Mixamo 骨架）
Target Armature:  Armature       （VRM 骨架）
```

#### 构建骨骼映射

点击 **`Build Bone List`**，插件自动列出骨骼对应关系。

检查并手动修正以下主要骨骼映射：

| Target（VRM）   | Source（Mixamo）           |
|----------------|---------------------------|
| hips           | mixamorig:Hips            |
| spine          | mixamorig:Spine           |
| chest          | mixamorig:Spine1          |
| upperChest     | mixamorig:Spine2          |
| neck           | mixamorig:Neck            |
| head           | mixamorig:Head            |
| leftUpperArm   | mixamorig:LeftArm         |
| leftLowerArm   | mixamorig:LeftForeArm     |
| leftHand       | mixamorig:LeftHand        |
| rightUpperArm  | mixamorig:RightArm        |
| rightLowerArm  | mixamorig:RightForeArm    |
| rightHand      | mixamorig:RightHand       |
| leftUpperLeg   | mixamorig:LeftUpLeg       |
| leftLowerLeg   | mixamorig:LeftLeg         |
| leftFoot       | mixamorig:LeftFoot        |
| rightUpperLeg  | mixamorig:RightUpLeg      |
| rightLowerLeg  | mixamorig:RightLeg        |
| rightFoot      | mixamorig:RightFoot       |

#### 执行重定向

点击 **`Retarget Animation`**。

完成后拖动底部时间轴，VRM 骨架应跟随 Mixamo 动画运动。

---

### Step 6：导出为 .vrma

1. 在 Outliner 中点击选中 **Armature**（VRM 那个）
2. `File` → `Export` → `VRM Animation (.vrma)`
3. 命名并选择保存路径，导出

---

### Step 7：集成到项目

将 `.vrma` 文件复制到：

```
character/public/assets/vrma/<动画名>.vrma
```

然后修改以下两个文件：

**① `character/app/components/vrmaManifest.ts`**

```typescript
export type VRMAMotionName =
  | 'full_pose'
  | ...
  | '<动画名>';          // 新增

export const VRMA_MANIFEST: Record<VRMAMotionName, string> = {
  ...
  '<动画名>': '/assets/vrma/<动画名>.vrma',  // 新增
};
```

**② `EmoMate/src/types/vrm.ts`**

```typescript
export type VRMAMotionName =
  | 'full_pose'
  | ...
  | '<动画名>';          // 新增，需与 character 侧保持一致
```

**③ `EmoMate/src/screens/HomeScreen.tsx`**（可选，添加调试按钮）

```typescript
const VRMA_MOTION_LABELS: Record<VRMAMotionName, string> = {
  ...
  '<动画名>': '中文标签',  // 新增
};
```

---

## 注意事项

| 问题 | 说明 |
|------|------|
| T-Pose vs A-Pose | Mixamo 用 T-Pose，多数 VRM 用 A-Pose，重定向后手臂角度可能需在 Blender 中微调 |
| 根位移漂移 | Mixamo 动画含根位移，导出前可在 NLA Editor 中移除根骨骼位移关键帧 |
| 帧率不一致 | Mixamo 默认 30fps，Blender 中统一设置即可 |
| 重定向后骨架不动 | 检查 Source/Target 骨架是否选反，或骨骼名称映射有误 |
| VRMAPlayer 播放一次后回 idle | 这是设计行为（`LoopOnce + clampWhenFinished`），循环动画需修改 `VRMAPlayer.play()` |

---

## 已有动画清单

| 文件 | 名称 | 来源 | 触发方式 |
|------|------|------|---------|
| `VRMA_01.vrma` | full_pose | VRoid 官方 | 调试按钮 |
| `VRMA_02.vrma` | greeting  | VRoid 官方 | 调试按钮 |
| `VRMA_03.vrma` | v_sign    | VRoid 官方 | 调试按钮 |
| `VRMA_04.vrma` | photo_pose| VRoid 官方 | 调试按钮 |
| `VRMA_05.vrma` | spin      | VRoid 官方 | 调试按钮 |
| `VRMA_06.vrma` | model_pose| VRoid 官方 | 调试按钮 |
| `VRMA_07.vrma` | crouch    | VRoid 官方 | 调试按钮 |
| `angry.vrma`   | angry     | Mixamo 自制 | 调试按钮 / `motionCoordinator.onAIMotion('angry')` |

# Live2D → VRM 全量重命名设计

**日期**: 2026-04-23  
**状态**: 已批准  
**范围**: EmoMate + character 两个子项目

## 背景

项目已完成从 Live2D（Hiyori 模型）到 VRM（兰兰模型）的实际代码迁移，但以下层面仍保留大量 Live2D/Hiyori 命名：类型名、函数名、组件文件名、配置键、注释、文档。本次设计目标是将这些遗留命名统一清理，使代码与实际运行的模型一致，并采用模型无关的通用命名（避免未来换模型再次大规模重命名）。

## 目标

- 消除所有 `Live2D`、`Hiyori` 遗留命名（类型、函数、常量、配置键、注释）
- 采用模型无关命名：`Avatar`（角色逻辑）、`Character`（UI 组件）
- 删除已过时的 Live2D 文档，不补写新文档（桥接协议已在代码中体现）
- 不改变任何运行逻辑，仅改名和注释

## 命名规则

- **类型/接口**：用 `Avatar` 前缀（`AvatarMotion`、`AvatarBridge`、`AvatarStatus`）
- **UI 组件/文件**：用 `Character` 前缀（`CharacterWebView`、`CharacterAvatar`）
- **配置/环境变量**：用 `character` 前缀（`characterViewUrl`）
- **Store 键**：用 `avatar`（`avatar`、`avatarSystem`）

## 重命名映射

### 文件重命名

| 旧文件名 | 新文件名 |
|---------|---------|
| `EmoMate/src/components/HiyoriWebView.tsx` | `CharacterWebView.tsx` |
| `EmoMate/src/components/Live2DCharacter.tsx` | `CharacterAvatar.tsx` |

### 类型 / 接口

| 旧名 | 新名 | 所在文件 |
|-----|-----|---------|
| `HiyoriMotion` | `AvatarMotion` | `useAIStatus.ts`, `monitor.ts`, `motionMapper.ts`, 多处 |
| `HiyoriBridge` | `AvatarBridge` | `CharacterWebView.tsx` |
| `Live2DStatus` | `AvatarStatus` | `monitor.ts`, `monitorStore.ts` |
| `Live2DCharacterProps` | `CharacterAvatarProps` | `CharacterAvatar.tsx` |

### 函数 / 常量

| 旧名 | 新名 | 所在文件 |
|-----|-----|---------|
| `HIYORI_MOTIONS` | `AVATAR_MOTIONS` | `CharacterAvatar.tsx` |
| `validateHiyoriMotion` | `validateAvatarMotion` | `CharacterAvatar.tsx` |
| `playLive2DMotion` | `playAvatarMotion` | `CharacterAvatar.tsx` |
| `updateLive2DStatus` | `updateAvatarStatus` | `monitorStore.ts` |
| `emotionToHiyoriMotion` | `emotionToAvatarMotion` | `motionMapper.ts` |
| `getHiyoriViewUrl` | `getCharacterViewUrl` | `CharacterWebView.tsx` |

### Store 键 / 配置键

| 旧名 | 新名 | 所在文件 |
|-----|-----|---------|
| `live2d`（state key） | `avatar` | `monitorStore.ts` |
| `live2dSystem` | `avatarSystem` | `monitor.ts` |
| `hiyoriViewUrl` | `characterViewUrl` | `app.config.ts` |

## 变更文件清单

### 源码文件（15 个）

1. `EmoMate/src/store/useAIStatus.ts` — 类型 + 注释
2. `EmoMate/src/store/index.ts` — 导出名
3. `EmoMate/src/store/monitorStore.ts` — 类型、函数名、state key
4. `EmoMate/src/types/monitor.ts` — 接口名、字段名
5. `EmoMate/src/capabilities/motion/motionMapper.ts` — 类型、函数名、文件头注释
6. `EmoMate/src/constants/ai.ts` — 配置值、注释
7. `EmoMate/src/constants/personality.ts` — 注释
8. `EmoMate/src/components/index.ts` — 导出路径（新文件名）
9. `EmoMate/src/components/HiyoriWebView.tsx` → **重命名** `CharacterWebView.tsx` + 内部引用
10. `EmoMate/src/components/Live2DCharacter.tsx` → **重命名** `CharacterAvatar.tsx` + 内部引用
11. `EmoMate/src/components/EmotionAwareCharacter.tsx` — import 路径、类型引用、注释
12. `EmoMate/src/components/FunctionMonitor.tsx` — `Live2DStatus` 显示逻辑
13. `EmoMate/src/screens/HomeScreen.tsx` — JSX 注释
14. `EmoMate/src/capabilities/speak/fishAudioAPI.ts` — 注释
15. `EmoMate/app.config.ts` — `hiyoriViewUrl` → `characterViewUrl`

### 文档文件（3 个更新）

- `CLAUDE.md`（根目录）— 全文 Live2D → VRM，架构描述
- `EmoMate/CLAUDE.md` — 全文 Live2D/Hiyori → Avatar 通用表述
- `character/CLAUDE.md` — 全文 Live2D → VRM，组件名

### 删除文件（3 个）

- `EmoMate/docs/LIVE2D.md`
- `character/hiyori_bridge_documentation.md`
- `character/SHIZUKU_MODEL_ANALYSIS.md`

## 执行顺序（由内到外，TypeScript 引导）

### Step 1 — 核心类型层

- `useAIStatus.ts`：`HiyoriMotion` → `AvatarMotion`
- `monitor.ts`：`Live2DStatus` → `AvatarStatus`，`live2dSystem` → `avatarSystem`

### Step 2 — Store 层

- `index.ts`：更新导出
- `monitorStore.ts`：函数名、state key

### Step 3 — 能力 / 常量层

- `motionMapper.ts`：类型名、函数名
- `ai.ts`、`personality.ts`：注释和配置值

### Step 4 — 组件层

- 重命名 `HiyoriWebView.tsx` → `CharacterWebView.tsx`，更新内部引用
- 重命名 `Live2DCharacter.tsx` → `CharacterAvatar.tsx`，更新内部引用
- `EmotionAwareCharacter.tsx`、`FunctionMonitor.tsx`、`HomeScreen.tsx`：import + 引用
- `components/index.ts`：导出路径

### Step 5 — 配置层

- `app.config.ts`：`hiyoriViewUrl` → `characterViewUrl`
- `fishAudioAPI.ts`：注释

### Step 6 — 文档层

- 更新 3 个 CLAUDE.md

### Step 7 — 清理

- 删除 3 个遗留文档

### 验证节点

每步完成后运行 `npx tsc --noEmit`（在 EmoMate 目录）。Step 4 完成后应达到零 TypeScript 错误。

## 不在范围内

- 不改变任何业务逻辑
- 不新增文档
- 不修改 character 端源码（已使用 VRM 命名）
- 不处理 `.env` 文件（`HIYORI_VIEW_URL` 环境变量名由用户自行决定是否改为 `CHARACTER_VIEW_URL`；`app.config.ts` 只改 `extra` 的键名，读取哪个 env var 不变）
- `getAvailableMotions`、`isTemporaryMotion`、`getMotionDuration`、`MotionTransition` 等已是通用命名，不改

# Live2D → VRM 全量重命名 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 EmoMate 中所有 Live2D/Hiyori 遗留命名统一改为模型无关的通用命名（Avatar/Character），删除过时 Live2D 文档，更新三个 CLAUDE.md。

**Architecture:** 由内到外（类型层 → Store 层 → 能力层 → 组件层 → 配置层 → 文档层），每步完成后运行 `npx tsc --noEmit` 验证。仅改名，不改任何业务逻辑。

**Tech Stack:** TypeScript, React Native, Zustand, Expo

---

## 文件清单

| 操作 | 文件 |
|------|------|
| 修改 | `EmoMate/src/store/useAIStatus.ts` |
| 修改 | `EmoMate/src/types/monitor.ts` |
| 修改 | `EmoMate/src/store/index.ts` |
| 修改 | `EmoMate/src/store/monitorStore.ts` |
| 修改 | `EmoMate/src/capabilities/motion/motionMapper.ts` |
| 修改 | `EmoMate/src/constants/ai.ts` |
| 修改 | `EmoMate/src/constants/personality.ts` |
| 重命名+修改 | `EmoMate/src/components/HiyoriWebView.tsx` → `CharacterWebView.tsx` |
| 重命名+修改 | `EmoMate/src/components/Live2DCharacter.tsx` → `CharacterAvatar.tsx` |
| 修改 | `EmoMate/src/components/EmotionAwareCharacter.tsx` |
| 修改 | `EmoMate/src/components/FunctionMonitor.tsx` |
| 修改 | `EmoMate/src/components/index.ts` |
| 修改 | `EmoMate/src/screens/HomeScreen.tsx` |
| 修改 | `EmoMate/src/capabilities/speak/fishAudioAPI.ts` |
| 修改 | `EmoMate/app.config.ts` |
| 更新 | `CLAUDE.md`（根目录） |
| 更新 | `EmoMate/CLAUDE.md` |
| 更新 | `character/CLAUDE.md` |
| 删除 | `EmoMate/docs/LIVE2D.md` |
| 删除 | `character/hiyori_bridge_documentation.md` |
| 删除 | `character/SHIZUKU_MODEL_ANALYSIS.md` |

---

## Task 1: 核心类型层 — useAIStatus.ts

**Files:**

- Modify: `EmoMate/src/store/useAIStatus.ts`

- [ ] **Step 1: 重命名 HiyoriMotion → AvatarMotion**

  将文件中所有 `HiyoriMotion` 替换为 `AvatarMotion`，同时更新注释：

  ```typescript
  // 第3行注释改为：
  // Avatar motion type — model-agnostic motion names

  // 第4行：
  type AvatarMotion =

  // 第33行：
  currentMotion: AvatarMotion;

  // 第52行：
  aiStatus: AvatarMotion;

  // 第53行：
  setAIStatus: (status: AvatarMotion) => void;

  // 第65行：
  motion: AvatarMotion;

  // 第231行：
  setAIStatus: (status: AvatarMotion) => {

  // 第254行：
  export type { AvatarMotion, AIActivityState, AIDerivedState, AIStatusStore };
  ```

- [ ] **Step 2: 验证编译（预期有错误，类型被其他文件引用）**

  ```bash
  cd EmoMate && npx tsc --noEmit 2>&1 | grep "HiyoriMotion" | head -20
  ```

  预期：其他文件还引用 `HiyoriMotion`，错误存在。这是正常的，继续下一 Task。

- [ ] **Step 3: 暂存，不提交（等 Task 2 完成后一起提交）**

  ```bash
  git add EmoMate/src/store/useAIStatus.ts
  ```

---

## Task 2: 核心类型层 — monitor.ts

**Files:**

- Modify: `EmoMate/src/types/monitor.ts`

- [ ] **Step 1: 更新 monitor.ts 中的类型名和字段名**

  ```typescript
  // 第7行 import 改为：
  import { AvatarMotion } from '../store';

  // 第9-10行注释改为：
  // ============================================
  // Avatar System Monitoring
  // ============================================

  // 第13行注释改为：
  /**
   * Avatar model playback status
   */

  // 第27行：
  export interface AvatarStatus {

  // 第28行：
  currentMotion: AvatarMotion;

  // 第45行：
  aiStatus: AvatarMotion | null;

  // 第46行：
  selectedMotion: AvatarMotion;

  // 第87行注释改为：
    // Avatar System

  // 第89行：
  avatar: AvatarStatus;

  // 第103行：
  avatarSystem: boolean;
  ```

- [ ] **Step 2: 暂存**

  ```bash
  git add EmoMate/src/types/monitor.ts
  ```

---

## Task 3: Store 层 — index.ts + monitorStore.ts

**Files:**

- Modify: `EmoMate/src/store/index.ts`
- Modify: `EmoMate/src/store/monitorStore.ts`

- [ ] **Step 1: 更新 store/index.ts 导出名**

  ```typescript
  // 第3行改为：
  export { useAIStatus, type AvatarMotion } from './useAIStatus';
  ```

- [ ] **Step 2: 更新 monitorStore.ts**

  ```typescript
  // 第11行 import 改为：
  Live2DStatus → AvatarStatus

  // 完整 import 块改为：
  import {
    MonitorData,
    WebViewStatus,
    AvatarStatus,
    EmotionStatus,
    BackgroundSceneInfo,
    SceneUnderstandingStatus,
  } from '../types/monitor';

  // 第27行接口方法名：
  updateAvatarStatus: (status: Partial<AvatarStatus>) => void;

  // 第49行 initialState 中的 state key：
  avatar: {          // 原来是 live2d:
    currentMotion: 'Idle',
    isModelReady: false,
    isPlaying: false,
    shouldLoop: false,
  },

  // 第90-93行实现：
  updateAvatarStatus: (status: Partial<AvatarStatus>) => {
    set((state) => {
      Object.assign(state.data.avatar, status);
    });
  },
  ```

- [ ] **Step 3: 验证类型层编译**

  ```bash
  cd EmoMate && npx tsc --noEmit 2>&1 | grep -E "HiyoriMotion|Live2DStatus|live2dSystem" | head -20
  ```

  预期：这几个旧名称的错误消失或减少（其余文件还有引用）。

- [ ] **Step 4: 提交 Task 1-3**

  ```bash
  git add EmoMate/src/store/useAIStatus.ts EmoMate/src/types/monitor.ts EmoMate/src/store/index.ts EmoMate/src/store/monitorStore.ts
  git commit -m "refactor: rename HiyoriMotion→AvatarMotion, Live2DStatus→AvatarStatus in core type/store layer"
  ```

---

## Task 4: 能力层 — motionMapper.ts

**Files:**

- Modify: `EmoMate/src/capabilities/motion/motionMapper.ts`

- [ ] **Step 1: 更新文件头注释**

  ```typescript
  /**
   * Motion Mapper - Context-Aware Avatar Motion Selection
   *
   * Features:
   * - Context-aware motion selection based on conversation content
   * - Emotion-based motion mapping with fine-grained control
   * - AI status integration (speaking, thinking, etc.)
   * - Motion priority and transition management
   */
  ```

- [ ] **Step 2: 全量替换类型名和函数名**

  ```typescript
  // 第12行：
  import { AvatarMotion } from '../../store';

  // 第30行 MotionSelection 接口：
  motion: AvatarMotion;

  // 第52行 emotionMotionMap：
  const emotionMotionMap: Record<EmotionType, AvatarMotion> = {

  // 第67行 contextualEmotionMotions：
  const contextualEmotionMotions: Partial<Record<EmotionType, Partial<Record<string, AvatarMotion>>>> = {

  // 第158行：
  let selectedMotion: AvatarMotion = 'Idle';

  // 第231行：
  let contextMotion: AvatarMotion | undefined;

  // 第295行 函数名改为：
  export function emotionToAvatarMotion(emotion: EmotionType): AvatarMotion {

  // 第302-303行 MotionTransition 接口：
  from: AvatarMotion;
  to: AvatarMotion;

  // 第311-312行 calculateMotionTransition 参数：
  currentMotion: AvatarMotion,
  targetMotion: AvatarMotion

  // 第347行 isTemporaryMotion：
  export function isTemporaryMotion(motion: AvatarMotion): boolean {

  // 第348行：
  const temporaryMotions: AvatarMotion[] = [

  // 第363行：
  export function getMotionDuration(motion: AvatarMotion): number {

  // 第364行：
  const durations: Partial<Record<AvatarMotion, number>> = {

  // 第382-384行注释：
  /**
   * Get all available avatar motions
   */

  // 第384行：
  export function getAvailableMotions(): AvatarMotion[] {
  ```

- [ ] **Step 3: 暂存并提交**

  ```bash
  git add EmoMate/src/capabilities/motion/motionMapper.ts
  git commit -m "refactor: rename HiyoriMotion→AvatarMotion in motionMapper"
  ```

---

## Task 5: 常量层 — ai.ts + personality.ts

**Files:**

- Modify: `EmoMate/src/constants/ai.ts`
- Modify: `EmoMate/src/constants/personality.ts`

- [ ] **Step 1: 更新 ai.ts 中的配置值和注释**

  用编辑器搜索以下字符串并替换：

  ```
  'Live2D Hiyori'  →  'VRM Avatar'
  hiyoriMotions    →  avatarMotions
  Live2D Hiyori动作系统  →  VRM Avatar动作系统
  Hiyori模型支持的11个动作  →  Avatar支持的动作列表
  hiyoriMotion:    →  avatarMotion:
  Live2D情感表达映射  →  Avatar情感表达映射
  可以通过Live2D角色  →  可以通过VRM角色
  HiyoriWebView + Live2DCharacter  →  CharacterWebView + CharacterAvatar
  ```

- [ ] **Step 2: 更新 personality.ts 中的注释**

  ```
  Live2D Hiyori动作系统  →  VRM Avatar动作系统
  Live2D角色  →  VRM角色（保留功能描述，只改技术术语）
  ```

- [ ] **Step 3: 提交**

  ```bash
  git add EmoMate/src/constants/ai.ts EmoMate/src/constants/personality.ts
  git commit -m "refactor: update Live2D references in constants to VRM/Avatar"
  ```

---

## Task 6: 组件层 — 重命名 HiyoriWebView → CharacterWebView

**Files:**

- Rename + Modify: `EmoMate/src/components/HiyoriWebView.tsx` → `CharacterWebView.tsx`

- [ ] **Step 1: 用 git mv 重命名文件**

  ```bash
  git mv EmoMate/src/components/HiyoriWebView.tsx EmoMate/src/components/CharacterWebView.tsx
  ```

- [ ] **Step 2: 更新文件内部所有引用**

  替换以下字符串（保留调试日志中的字符串字面量含义，只改代码标识符）：

  ```typescript
  // 接口名：
  interface HiyoriWebViewProps  →  interface CharacterWebViewProps
  interface HiyoriBridge        →  interface AvatarBridge

  // 函数名：
  const getHiyoriViewUrl        →  const getCharacterViewUrl

  // config 键：
  Constants.expoConfig?.extra?.hiyoriViewUrl  →  Constants.expoConfig?.extra?.characterViewUrl

  // forwardRef 组件名：
  const HiyoriWebView = React.forwardRef<any, HiyoriWebViewProps>(
  →
  const CharacterWebView = React.forwardRef<any, CharacterWebViewProps>(

  // 调试日志中的字符串（这些是日志标识，也一并改）：
  'HiyoriWebView'  →  'CharacterWebView'
  'HiyoriBridge'   →  'AvatarBridge'
  window.HiyoriBridge  →  window.AvatarBridge

  // 注释：
  'Model ready (VRM or Live2D)'  →  'Model ready (VRM)'

  // export default：
  export default HiyoriWebView  →  export default CharacterWebView
  ```

  > **注意**：web 侧 JavaScript 代码 `window.HiyoriBridge` 也存在于 character 项目的 `VRMAvatar.tsx`，但 character 端已改为 VRM，检查一下是否还有 `HiyoriBridge` 字符串：
>
  > ```bash
  > grep -n "HiyoriBridge" /Users/yaonangu/Local_doc/GitHub/video-chat/character/app/components/VRMAvatar.tsx | head -5
  > ```
>
  > 如果有，保持 character 端不变（本次不改 character 端代码）；EmoMate 端注入的 JS bridge 名改为 `AvatarBridge`，同时 character 端的 VRMAvatar.tsx 需要在下一个任务之外单独确认是否也用了这个字符串。

- [ ] **Step 3: 暂存**

  ```bash
  git add EmoMate/src/components/CharacterWebView.tsx
  ```

---

## Task 7: 组件层 — 重命名 Live2DCharacter → CharacterAvatar

**Files:**

- Rename + Modify: `EmoMate/src/components/Live2DCharacter.tsx` → `CharacterAvatar.tsx`

- [ ] **Step 1: 用 git mv 重命名文件**

  ```bash
  git mv EmoMate/src/components/Live2DCharacter.tsx EmoMate/src/components/CharacterAvatar.tsx
  ```

- [ ] **Step 2: 更新文件内部所有引用**

  ```typescript
  // import 改为：
  import AvatarBridge from './CharacterWebView';
  import { useAIStatus, AvatarMotion } from '../store';

  // 常量名：
  const AVATAR_MOTIONS: AvatarMotion[] = [...]

  // 接口名：
  interface CharacterAvatarProps {
    status?: AvatarMotion;
    // ...
    hiyoriBridge: AvatarBridge;  →  avatarBridge: AvatarBridge;
  }

  // 函数名：
  const validateAvatarMotion = (motion: AvatarMotion | undefined): AvatarMotion => {

  // 组件名：
  const CharacterAvatar: React.FC<CharacterAvatarProps> = ({

  // 内部方法：
  const playAvatarMotion = useCallback(

  // monitorStore 调用：
  const updateAvatarStatus = useMonitorStore((state) => state.updateAvatarStatus);
  updateAvatarStatus({ ... })

  // 调试日志字符串：
  '[Live2DCharacter]'  →  '[CharacterAvatar]'
  '[Live2D ...'        →  '[Avatar ...'

  // export：
  export { AVATAR_MOTIONS };
  export default CharacterAvatar;
  ```

- [ ] **Step 3: 暂存**

  ```bash
  git add EmoMate/src/components/CharacterAvatar.tsx
  ```

---

## Task 8: 消费方组件更新

**Files:**

- Modify: `EmoMate/src/components/EmotionAwareCharacter.tsx`
- Modify: `EmoMate/src/components/FunctionMonitor.tsx`
- Modify: `EmoMate/src/components/index.ts`
- Modify: `EmoMate/src/screens/HomeScreen.tsx`

- [ ] **Step 1: 更新 EmotionAwareCharacter.tsx**

  ```typescript
  // 第3行 import 改为：
  import CharacterAvatar, { AVATAR_MOTIONS } from './CharacterAvatar';

  // 第5行 import 改为：
  import { useAIStatus, AvatarMotion, useEmotionStore, useMonitorStore } from '../store';

  // 第46行类型：
  const currentMotion = React.useMemo((): AvatarMotion => {

  // 第183行 JSX + prop 名：
  <CharacterAvatar
    avatarBridge={...}   // 原 hiyoriBridge={...}，与 Task 7 中的 prop 改名保持一致

  // 注释行改为：
  {/* Avatar Character - Standing at the bottom, extends beyond bottom edge */}
  ```

- [ ] **Step 2: 更新 FunctionMonitor.tsx**

  ```typescript
  // 第142行 expandedSections 初始值：
  avatar: true,     // 原 live2d: true

  // 第167行变量名：
  const avatarStatusColor = data.avatar.isModelReady  // 原 live2dStatusColor, data.live2d

  // 第225-230行 JSX section：
  title='Avatar System'                               // 原 'Live2D System'
  isExpanded={expandedSections.avatar}                // 原 .live2d
  onToggle={() => toggleSection('avatar')}            // 原 'live2d'
  statusColor={avatarStatusColor}                     // 原 live2dStatusColor

  // 第263-279行 data 访问：
  data.avatar.currentMotion    // 原 data.live2d.currentMotion
  data.avatar.isModelReady     // 原 data.live2d.isModelReady
  data.avatar.isPlaying        // 原 data.live2d.isPlaying
  data.avatar.shouldLoop       // 原 data.live2d.shouldLoop
  ```

  注意 `toggleSection` 的参数类型是 `keyof typeof expandedSections`，改了键名后 TypeScript 自动推断，不需要手动声明。

- [ ] **Step 3: 更新 components/index.ts**

  ```typescript
  // 第7行：
  export { default as CharacterWebView } from './CharacterWebView';

  // 第8行：
  export { default as CharacterAvatar } from './CharacterAvatar';
  ```

  > 注意：如果其他文件通过 barrel `'../components'` 引入了旧名称（`HiyoriWebView`、`Live2DCharacter`），TypeScript 编译时会报错提示，按提示修改即可。

- [ ] **Step 4: 更新 HomeScreen.tsx**

  搜索并替换 JSX 注释：

  ```tsx
  {/* Live2D Character */}  →  {/* Avatar Character */}
  ```

- [ ] **Step 5: 验证编译**

  ```bash
  cd EmoMate && npx tsc --noEmit 2>&1 | head -30
  ```

  预期：零错误或仅剩下 Task 9 相关的配置键错误（`hiyoriViewUrl`）。

- [ ] **Step 6: 提交 Task 6-8**

  ```bash
  git add EmoMate/src/components/
  git add EmoMate/src/screens/HomeScreen.tsx
  git commit -m "refactor: rename HiyoriWebView→CharacterWebView, Live2DCharacter→CharacterAvatar"
  ```

---

## Task 9: 配置层 — app.config.ts + fishAudioAPI.ts

**Files:**

- Modify: `EmoMate/app.config.ts`
- Modify: `EmoMate/src/capabilities/speak/fishAudioAPI.ts`

- [ ] **Step 1: 更新 app.config.ts**

  ```typescript
  // 第82行改为：
  characterViewUrl: process.env.HIYORI_VIEW_URL,
  ```

  > **说明**：env var 名保持 `HIYORI_VIEW_URL` 不变（用户决定是否改 `.env`），但 `extra` 的键名改为 `characterViewUrl`，这样 `CharacterWebView.tsx` 中 `Constants.expoConfig?.extra?.characterViewUrl` 可以正确读取。

- [ ] **Step 2: 更新 fishAudioAPI.ts 注释**

  找到 "future Live2D integration" 注释行，改为：

  ```typescript
  // annotate intended animations/expressions for future avatar integration.
  ```

- [ ] **Step 3: 验证编译应为零错误**

  ```bash
  cd EmoMate && npx tsc --noEmit
  ```

  预期：**零错误**。

- [ ] **Step 4: 提交**

  ```bash
  git add EmoMate/app.config.ts EmoMate/src/capabilities/speak/fishAudioAPI.ts
  git commit -m "refactor: rename hiyoriViewUrl→characterViewUrl in app config"
  ```

---

## Task 10: 文档更新 — 三个 CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`（根目录）
- Modify: `EmoMate/CLAUDE.md`
- Modify: `character/CLAUDE.md`

- [ ] **Step 1: 更新根目录 CLAUDE.md**

  全文替换以下字符串：

  ```
  Live2D character interaction  →  VRM character interaction
  web-based Live2D character displays  →  web-based VRM character display
  Live2D Character System  →  VRM Character System
  Full Hiyori VTuber model support (11 motions)  →  VRM avatar (兰兰) with motion + expression support
  Live2D motion mapper  →  Avatar motion mapper
  HiyoriWebView.tsx # WebView wrapper for character  →  CharacterWebView.tsx # WebView wrapper for character
  HiyoriLive2D.tsx  →  VRMAvatar.tsx
  public/assets/live2d/  →  public/assets/vrm/
  Live2D character interaction  →  VRM character interaction
  pixi-live2d-display-mulmotion for Live2D  →  @pixiv/three-vrm for VRM rendering
  Live2D / Motion System  →  VRM / Motion System
  Plutchik 8-emotion model → Hiyori motion mapping  →  Plutchik 8-emotion model → VRM avatar motion mapping
  11 motions: Idle, Happy, Surprised, Shy, Wave, Dance, Laugh, Thinking, Speaking, Excited, Sleepy  →  Motions: Idle, Happy, Surprised, Shy, Wave, Dance, Laugh, Thinking, Speaking, Excited, Sleepy
  Lip sync for Live2D  →  Lip sync improvements
  Live2D character animation  →  VRM character animation
  ```

  同时更新 "Current Development Status" 中 Live2D 相关条目，改为：

  ```
  - **VRM Character System**: ✅ VRM avatar (兰兰) with motion + lip sync support
  ```

  更新 Tech Stack 中的 character 项目描述：

  ```
  - Three.js + @pixiv/three-vrm for VRM rendering (replaces PIXI.js + Live2D)
  ```

- [ ] **Step 2: 更新 EmoMate/CLAUDE.md**

  全文替换以下字符串：

  ```
  Live2D  →  VRM（保留专有名词如 LIVE2D.md 文件路径暂不改，因为该文件将被删除）
  Hiyori  →  Avatar（在组件名和 API 名上）
  HiyoriWebView  →  CharacterWebView
  Live2DCharacter  →  CharacterAvatar
  HiyoriScreen  →  （已删除，移除相关行）
  Live2D integration  →  VRM avatar integration
  11 motions  →  avatar motions
  pixi-live2d  →  @pixiv/three-vrm
  HIYORI_INTEGRATION.md  →  （对应文档已删除，从文档列表中移除）
  ```

- [ ] **Step 3: 更新 character/CLAUDE.md**

  character 端已使用 VRM，CLAUDE.md 仍描述 Live2D。全文改写关键部分：

  ```
  The Character project is a Remix-based web application that displays VRM models...
  Live2D Integration → VRM Integration
  HiyoriLive2D.tsx → VRMAvatar.tsx（主组件）
  Live2D Ready → VRM Ready
  pixi-live2d-display-mulmotion → @pixiv/three-vrm
  Live2D model loading → VRM model loading
  HiyoriBridge → AvatarBridge
  ```

  同时更新项目结构树，将 `HiyoriLive2D.tsx`、`ShizukuLive2D.tsx`、`live2d.d.ts`、`live2d/` 改为：

  ```
  VRMAvatar.tsx
  ExpressionController.tsx
  LipSyncController.tsx
  vrm/
  ```

- [ ] **Step 4: 提交文档更新**

  ```bash
  git add CLAUDE.md EmoMate/CLAUDE.md character/CLAUDE.md
  git commit -m "docs: update CLAUDE.md files from Live2D to VRM terminology"
  ```

---

## Task 11: 删除遗留 Live2D 文档

**Files:**

- Delete: `EmoMate/docs/LIVE2D.md`
- Delete: `character/hiyori_bridge_documentation.md`
- Delete: `character/SHIZUKU_MODEL_ANALYSIS.md`

- [ ] **Step 1: 删除文件**

  ```bash
  git rm EmoMate/docs/LIVE2D.md
  git rm character/hiyori_bridge_documentation.md
  git rm character/SHIZUKU_MODEL_ANALYSIS.md
  ```

- [ ] **Step 2: 提交**

  ```bash
  git commit -m "chore: delete obsolete Live2D documentation files"
  ```

---

## Task 12: 最终验证

- [ ] **Step 1: TypeScript 零错误验证**

  ```bash
  cd EmoMate && npx tsc --noEmit
  ```

  预期：无任何错误输出，命令退出码为 0。

- [ ] **Step 2: 全局残留检查**

  ```bash
  grep -rn "HiyoriMotion\|HiyoriBridge\|Live2DStatus\|live2dSystem\|updateLive2DStatus\|HIYORI_MOTIONS\|HiyoriWebView\|Live2DCharacter\|hiyoriViewUrl\|emotionToHiyoriMotion\|getHiyoriViewUrl\|validateHiyoriMotion\|playLive2DMotion" \
    /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate/src \
    /Users/yaonangu/Local_doc/GitHub/video-chat/EmoMate/app.config.ts \
    --include="*.ts" --include="*.tsx"
  ```

  预期：**零匹配**。如有残留，修复后重新提交。

- [ ] **Step 3: 确认文件已删除**

  ```bash
  ls EmoMate/docs/LIVE2D.md character/hiyori_bridge_documentation.md character/SHIZUKU_MODEL_ANALYSIS.md 2>&1
  ```

  预期：三个文件均报 "No such file or directory"。

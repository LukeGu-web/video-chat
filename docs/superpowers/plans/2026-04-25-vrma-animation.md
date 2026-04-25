# VRMA Animation Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.vrma` full-body animation playback to the VRM character, triggered by AI `<action>{"motion":"..."}` tags and (in debug mode) manual UI buttons.

**Architecture:** The character side gets a new `VRMAPlayer` class loaded into `ExpressionController` that preloads seven VRMA clips on mount and plays them on `playVRMA` commands. The EmoMate side extends `parseVRMAction` to recognise `{ motion }` payloads, and `MotionCoordinator` to queue VRMA playback after TTS ends via a new `pendingMotion` slot symmetric to the existing `pendingEmotion`.

**Tech Stack:** `@pixiv/three-vrm-animation` (new), Three.js AnimationMixer, TypeScript. No test runner — verify each task with `cd character && npm run typecheck` or `cd EmoMate && npx tsc --noEmit` (must produce zero errors).

> **Prerequisite:** Complete `docs/superpowers/plans/2026-04-24-motion-coordinator.md` first. This plan assumes `MotionCoordinator.ts` exists with `onAIAction`, `onTTSStart`, `onTTSEnd`, `pendingEmotion`, and that `parseVRMAction` already returns `{ intent: { emotion: EmotionType } | null, cleanText, hasPartialTag }`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `character/package.json` | Modify | Add `@pixiv/three-vrm-animation` dependency |
| `character/app/components/VRMAPlayer.ts` | **Create** | Encapsulates VRMA load + Three.js AnimationMixer playback |
| `character/app/components/vrmaManifest.ts` | **Create** | Maps motion ID → file path + UI label for all 7 clips |
| `character/app/components/ExpressionController.tsx` | Modify | Mount `VRMAPlayer`, preload clips, handle `playVRMA` command |
| `EmoMate/src/types/vrm.ts` | Modify | Add `VRMAMotionName` type; add `'playVRMA'` to `VRMCommand` |
| `EmoMate/src/utils/parseVRMAction.ts` | Modify | Extend `ActionIntent` to discriminated union; parse `{ motion }` |
| `EmoMate/src/capabilities/motion/MotionCoordinator.ts` | Modify | Add `pendingMotion` field + `onAIMotion()` method; update `onTTSEnd` |
| `EmoMate/src/hooks/useChatAI.ts` | Modify | Dispatch `onAIMotion` when motion intent parsed |
| `EmoMate/src/constants/ai.ts` | Modify | Add motion `<action>` rules to system prompt |
| `EmoMate/src/screens/HomeScreen.tsx` | Modify | Add VRMA debug button row (debug mode only) |

---

## Task 1: character — Install dependency

**Files:**
- Modify: `character/package.json`

- [ ] **Step 1: Install @pixiv/three-vrm-animation**

```bash
cd character
npm install @pixiv/three-vrm-animation
```

Expected: `added 1 package` (or similar). The package appears in `package.json` dependencies.

- [ ] **Step 2: Verify TypeScript can resolve the package**

```bash
cd character
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add character/package.json character/package-lock.json
git commit -m "chore(character): install @pixiv/three-vrm-animation"
```

---

## Task 2: character — Create VRMAPlayer class

**Files:**
- Create: `character/app/components/VRMAPlayer.ts`

- [ ] **Step 1: Create the file**

Create `character/app/components/VRMAPlayer.ts` with this exact content:

```typescript
import { VRM } from '@pixiv/three-vrm';
import {
  VRMAnimationLoaderPlugin,
  VRMAnimation,
  createVRMAnimationClip,
} from '@pixiv/three-vrm-animation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class VRMAPlayer {
  private mixer: THREE.AnimationMixer;
  private action: THREE.AnimationAction | null = null;

  constructor(private vrm: VRM) {
    this.mixer = new THREE.AnimationMixer(vrm.scene);
  }

  async load(url: string): Promise<THREE.AnimationClip> {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMAnimationLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    const anim: VRMAnimation = gltf.userData.vrmAnimations[0];
    return createVRMAnimationClip(anim, this.vrm);
  }

  play(clip: THREE.AnimationClip, onFinish: () => void): void {
    this.stop();
    const handler = () => {
      this.mixer.removeEventListener('finished', handler);
      onFinish();
    };
    this.mixer.addEventListener('finished', handler);
    this.action = this.mixer.clipAction(clip);
    this.action.setLoop(THREE.LoopOnce, 1);
    this.action.clampWhenFinished = true;
    this.action.play();
  }

  stop(): void {
    this.mixer.stopAllAction();
    this.action = null;
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }
}
```

> **Note on GLTFLoader import:** If `npm run typecheck` reports `Cannot find module 'three/addons/...'`, change the import to `'three/examples/jsm/loaders/GLTFLoader'` (no `.js` suffix).

- [ ] **Step 2: TypeScript check**

```bash
cd character
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add character/app/components/VRMAPlayer.ts
git commit -m "feat(character): add VRMAPlayer class for VRMA clip playback"
```

---

## Task 3: character — Asset manifest + ExpressionController integration

**Files:**
- Create: `character/app/components/vrmaManifest.ts`
- Modify: `character/app/components/ExpressionController.tsx`

- [ ] **Step 1: Create vrmaManifest.ts**

Create `character/app/components/vrmaManifest.ts`:

```typescript
export type VRMAMotionName =
  | 'full_pose'
  | 'greeting'
  | 'v_sign'
  | 'photo_pose'
  | 'spin'
  | 'model_pose'
  | 'crouch';

export const VRMA_MANIFEST: Record<VRMAMotionName, string> = {
  full_pose:  '/assets/vrma/VRMA_01.vrma',
  greeting:   '/assets/vrma/VRMA_02.vrma',
  v_sign:     '/assets/vrma/VRMA_03.vrma',
  photo_pose: '/assets/vrma/VRMA_04.vrma',
  spin:       '/assets/vrma/VRMA_05.vrma',
  model_pose: '/assets/vrma/VRMA_06.vrma',
  crouch:     '/assets/vrma/VRMA_07.vrma',
};
```

- [ ] **Step 2: Add imports to ExpressionController.tsx**

Open `character/app/components/ExpressionController.tsx`. Find the last import line (currently `import { MOTION_PRESETS, Keyframe } from './motionPresets';`) and add two more lines directly after it:

```typescript
import { VRMAPlayer } from './VRMAPlayer';
import { VRMA_MANIFEST } from './vrmaManifest';
```

- [ ] **Step 3: Add VRMA refs**

Inside `ExpressionController`, find this line:

```typescript
const idleReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Add two new refs directly after it:

```typescript
const vrmaPlayer = useRef<VRMAPlayer | null>(null);
const vrmaClips = useRef<Map<string, THREE.AnimationClip>>(new Map());
```

- [ ] **Step 4: Add VRMA mount useEffect**

Find the closing `};` and `}, []);` of the existing `useEffect` (the one that adds `window.addEventListener('message', handleMessage)`). Add a new, separate `useEffect` immediately after that closing block:

```typescript
  useEffect(() => {
    const player = new VRMAPlayer(vrm);
    vrmaPlayer.current = player;
    Object.entries(VRMA_MANIFEST).forEach(([name, url]) => {
      player.load(url).then(clip => {
        vrmaClips.current.set(name, clip);
      });
    });
    return () => { player.stop(); };
  }, [vrm]);
```

- [ ] **Step 5: Add playVRMA case to the message handler switch**

Inside the existing `switch (cmd.type)` block, find `case 'stopAll':` and add the following new case **directly before** it:

```typescript
        case 'playVRMA': {
          const clip = vrmaClips.current.get(cmd.data.name as string);
          if (!clip || !vrmaPlayer.current) break;
          presetState.current = { name: null, elapsed: 0, loop: false };
          vrmaPlayer.current.play(clip, () => {
            presetState.current = { name: 'idle', elapsed: 0, loop: true };
          });
          break;
        }
```

Also update the `VRMBridgeCommand` type import — `vrm-bridge.ts` must include `playVRMA` (done in Task 4 below). The TypeScript check in Step 6 will catch any type mismatch.

- [ ] **Step 6: Add update() call in useFrame**

Inside `useFrame`, find this line (near the end of the callback):

```typescript
    if (em) em.update();
    vrm.update(delta);
```

Insert `vrmaPlayer.current?.update(delta);` **between** those two lines:

```typescript
    if (em) em.update();
    vrmaPlayer.current?.update(delta);
    vrm.update(delta);
```

- [ ] **Step 7: Add playVRMA to VRMBridgeCommand in vrm-bridge.ts**

Open `character/app/types/vrm-bridge.ts`. Find the `VRMBridgeCommand` union type and add one new member at the end, before the closing semicolon:

```typescript
  | { type: 'playVRMA'; data: { name: string } }
```

The full union should now end with:

```typescript
  | { type: 'stopAll' }
  | { type: 'ping' }
  | { type: 'playVRMA'; data: { name: string } };
```

- [ ] **Step 8: TypeScript check**

```bash
cd character
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 9: Commit**

```bash
git add character/app/components/vrmaManifest.ts \
        character/app/components/ExpressionController.tsx \
        character/app/types/vrm-bridge.ts
git commit -m "feat(character): integrate VRMAPlayer into ExpressionController"
```

---

## Task 4: EmoMate — Extend types + parseVRMAction

**Files:**
- Modify: `EmoMate/src/types/vrm.ts`
- Modify: `EmoMate/src/utils/parseVRMAction.ts`

- [ ] **Step 1: Add VRMAMotionName to vrm.ts**

Open `EmoMate/src/types/vrm.ts`. Find the `VRMCommand` interface:

```typescript
export interface VRMCommand {
  type: 'setExpression' | 'playPreset' | 'playPose' | 'stopAll' | 'prepareVisemes' | 'stopVisemes' | 'lipSyncStart';
  data?: any;
}
```

Replace it with:

```typescript
export type VRMAMotionName =
  | 'full_pose'
  | 'greeting'
  | 'v_sign'
  | 'photo_pose'
  | 'spin'
  | 'model_pose'
  | 'crouch';

export interface VRMCommand {
  type: 'setExpression' | 'playPreset' | 'playPose' | 'stopAll' | 'prepareVisemes' | 'stopVisemes' | 'lipSyncStart' | 'playVRMA';
  data?: any;
}
```

- [ ] **Step 2: Rewrite parseVRMAction.ts**

Replace the entire content of `EmoMate/src/utils/parseVRMAction.ts` with:

```typescript
import { EmotionType } from '../types/emotion';
import { VRMAMotionName } from '../types/vrm';

export type ActionIntent =
  | { type: 'emotion'; emotion: EmotionType }
  | { type: 'motion';  motion: VRMAMotionName };

export interface ParseActionResult {
  intent: ActionIntent | null;
  cleanText: string;
  hasPartialTag: boolean;
}

const VALID_EMOTIONS = new Set<string>([
  'joy', 'laugh', 'surprise', 'shy', 'sad', 'excited', 'thinking', 'trust',
]);

const VALID_MOTIONS = new Set<string>([
  'full_pose', 'greeting', 'v_sign', 'photo_pose', 'spin', 'model_pose', 'crouch',
]);

export function parseVRMAction(text: string): ParseActionResult {
  let intent: ActionIntent | null = null;
  let cleanText = text;

  const completeRegex = /<action>([\s\S]*?)<\/action>/g;
  let match: RegExpExecArray | null;
  while ((match = completeRegex.exec(text)) !== null) {
    try {
      const payload = JSON.parse(match[1].trim()) as Record<string, unknown>;
      if (typeof payload.emotion === 'string' && VALID_EMOTIONS.has(payload.emotion)) {
        intent = { type: 'emotion', emotion: payload.emotion as EmotionType };
      } else if (typeof payload.motion === 'string' && VALID_MOTIONS.has(payload.motion)) {
        intent = { type: 'motion', motion: payload.motion as VRMAMotionName };
      }
    } catch {
      // invalid JSON — discard tag but still strip it from text
    }
  }
  cleanText = text.replace(/<action>[\s\S]*?<\/action>/g, '').trim();

  const partialStart = cleanText.lastIndexOf('<action>');
  let hasPartialTag = false;
  if (partialStart !== -1) {
    hasPartialTag = true;
    cleanText = cleanText.slice(0, partialStart).trim();
  }

  return { intent, cleanText, hasPartialTag };
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit
```

Expected: zero errors. If there are errors in `useChatAI.ts` about `intent.emotion` (because `intent` is now a discriminated union), those will be fixed in Task 6 — they are expected at this stage.

- [ ] **Step 4: Commit**

```bash
git add EmoMate/src/types/vrm.ts EmoMate/src/utils/parseVRMAction.ts
git commit -m "feat(EmoMate): extend VRMCommand and parseVRMAction for VRMA motion type"
```

---

## Task 5: EmoMate — Extend MotionCoordinator with VRMA support

**Files:**
- Modify: `EmoMate/src/capabilities/motion/MotionCoordinator.ts`

- [ ] **Step 1: Import VRMAMotionName**

Open `EmoMate/src/capabilities/motion/MotionCoordinator.ts`. Find the imports at the top and add:

```typescript
import { VRMAMotionName } from '../../types/vrm';
```

- [ ] **Step 2: Add pendingMotion field**

Find the `private pendingEmotion` field declaration inside the `MotionCoordinator` class. Add the new field directly after it:

```typescript
  private pendingMotion: VRMAMotionName | null = null;
```

- [ ] **Step 3: Add onAIMotion method**

Find the `onAIAction` method. Add a new `onAIMotion` method directly after it:

```typescript
  onAIMotion(motionName: VRMAMotionName): void {
    const isSpeaking =
      this.state === 'TTS_Speaking' ||
      this.state === 'TTS_Laughing' ||
      this.state.startsWith('TTS_Emotion');
    if (isSpeaking) {
      this.pendingMotion = motionName;
      this.pendingEmotion = null;
    } else {
      this.sendCommand({ type: 'playVRMA', data: { name: motionName } });
    }
  }
```

- [ ] **Step 4: Update onTTSEnd to check pendingMotion first**

Find the `onTTSEnd` method. It currently starts by checking `this.pendingEmotion`. Add a `pendingMotion` check **before** that existing check, so the method begins with:

```typescript
  onTTSEnd(): void {
    if (this.pendingMotion) {
      const name = this.pendingMotion;
      this.pendingMotion = null;
      this.pendingEmotion = null;
      this.sendCommand({ type: 'playVRMA', data: { name } });
      this.setState('Idle');
      return;
    }
    // existing pendingEmotion check follows unchanged ...
```

Leave everything after the new block unchanged.

- [ ] **Step 5: Export onAIMotion from capabilities/motion/index.ts**

Open `EmoMate/src/capabilities/motion/index.ts`. Verify it exports `motionCoordinator` (added by the motion coordinator plan). No new line needed unless the export is missing.

- [ ] **Step 6: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add EmoMate/src/capabilities/motion/MotionCoordinator.ts
git commit -m "feat(EmoMate): add pendingMotion and onAIMotion to MotionCoordinator"
```

---

## Task 6: EmoMate — Wire useChatAI + update AI prompt

**Files:**
- Modify: `EmoMate/src/hooks/useChatAI.ts`
- Modify: `EmoMate/src/constants/ai.ts`

- [ ] **Step 1: Update the action dispatch in useChatAI.ts**

Open `EmoMate/src/hooks/useChatAI.ts`. Find the block that currently handles `intent` from `parseVRMAction` (added by the motion coordinator plan). It looks like:

```typescript
const { intent, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
if (intent) {
  motionCoordinator.onAIAction(intent.emotion);
}
```

Replace the `if (intent)` block with a discriminated check:

```typescript
              const { intent, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
              if (intent?.type === 'emotion') {
                motionCoordinator.onAIAction(intent.emotion);
              } else if (intent?.type === 'motion') {
                motionCoordinator.onAIMotion(intent.motion);
              }
```

- [ ] **Step 2: Add motion action rules to the system prompt in ai.ts**

Open `EmoMate/src/constants/ai.ts`. Find the `<action>` format rule that the motion coordinator plan added to the system prompt. It will look something like:

```
When expressing emotion, insert an <action> tag before the relevant sentence:
<action>{"emotion":"laugh"}</action>哈哈哈，真的好笑！
...
emotion values: joy / laugh / surprise / shy / sad / excited / thinking / trust
```

Append the following paragraph directly after the existing emotion action rules (inside the same string, before the closing quote):

```
When the user asks you to pose, gesture, or move your body, insert a motion <action> tag before the response:

<action>{"motion":"spin"}</action>好的，转一圈给你看！
<action>{"motion":"v_sign"}</action>这样可以吗？

Available motion values:
- full_pose   全身展示
- greeting    问候/打招呼
- v_sign      比V字手势
- photo_pose  拍照姿势
- spin        旋转一圈
- model_pose  模特走秀姿势
- crouch      蹲下

Motion rules: max 1 motion action per reply; do not use motion and emotion actions together in the same reply; only use when the user explicitly requests a pose or movement.
```

- [ ] **Step 3: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add EmoMate/src/hooks/useChatAI.ts EmoMate/src/constants/ai.ts
git commit -m "feat(EmoMate): dispatch onAIMotion in useChatAI; add motion action prompt rules"
```

---

## Task 7: EmoMate — Debug buttons in HomeScreen

**Files:**
- Modify: `EmoMate/src/screens/HomeScreen.tsx`

- [ ] **Step 1: Add missing imports**

Open `EmoMate/src/screens/HomeScreen.tsx`. Find the existing React Native import line at the top:

```typescript
import { View, Text, ImageBackground, ActivityIndicator } from 'react-native';
```

Add `ScrollView` and `TouchableOpacity` to that import:

```typescript
import { View, Text, ImageBackground, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
```

Also add an import for `isDebugMode` if it is not already imported:

```typescript
import { isDebugMode } from '../utils/debug';
```

Add an import for `VRMAMotionName` and the label map. Add this line with the other imports:

```typescript
import { VRMAMotionName } from '../types/vrm';
```

- [ ] **Step 2: Add the label constant**

At module level (outside the component), add:

```typescript
const VRMA_MOTION_LABELS: Record<VRMAMotionName, string> = {
  full_pose:  '全身照',
  greeting:   '问候',
  v_sign:     'V字',
  photo_pose: '拍摄',
  spin:       '旋转',
  model_pose: '模特',
  crouch:     '蹲姿',
};
```

- [ ] **Step 3: Add the import for motionCoordinator**

Add this import alongside the other capability imports at the top of `HomeScreen.tsx`:

```typescript
import { motionCoordinator } from '../capabilities/motion';
```

- [ ] **Step 4: Add the debug button row to the JSX**

Find the location where other debug UI is rendered (look for `{isDebugMode() && ...}`). Add the following block after the existing debug UI:

```tsx
        {isDebugMode() && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ position: 'absolute', bottom: 120, left: 0, right: 0 }}
            contentContainerStyle={{ paddingHorizontal: 8, gap: 8 }}
          >
            {(Object.entries(VRMA_MOTION_LABELS) as [VRMAMotionName, string][]).map(
              ([name, label]) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => motionCoordinator.onAIMotion(name)}
                  style={{
                    backgroundColor: 'rgba(100,60,200,0.75)',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        )}
```

> **Note:** `onAIMotion` plays the clip immediately when the coordinator is Idle (typical in debug use). If TTS is active when the button is tapped, the clip queues and plays after speech ends — same as the normal AI flow.

- [ ] **Step 4: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add EmoMate/src/screens/HomeScreen.tsx
git commit -m "feat(EmoMate): add VRMA debug button row to HomeScreen"
```

---

## Manual Integration Test

After all tasks pass TypeScript checks:

- [ ] Start the character server: `cd character && npm run dev`
- [ ] Start EmoMate in debug mode: `cd EmoMate && SHOW_TEST_COMPONENTS=true npx expo start`
- [ ] Open the app — verify the VRMA debug button row appears at the bottom
- [ ] Tap each button and confirm the matching animation plays and the character returns to idle afterward
- [ ] Say "转一圈" to the AI — confirm the character spins after the AI finishes speaking (not during)
- [ ] Say "比个V" — confirm v_sign plays after TTS ends
- [ ] Verify that during a VRMA clip, sending `playPreset` (e.g. from camera emotion) does not interrupt

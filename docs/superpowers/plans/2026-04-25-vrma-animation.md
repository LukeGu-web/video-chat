# VRMA Animation Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.vrma` full-body animation playback to the VRM character, triggered by AI `<action>{"motion":"..."}` tags and (in debug mode) manual UI buttons.

**Architecture:** The character side gets a new `VRMAPlayer` class loaded into `ExpressionController` that preloads seven VRMA clips on mount and plays them on `playVRMA` commands. The EmoMate side extends `parseVRMAction` to recognise `{ motion }` payloads, and `MotionCoordinator` to queue VRMA playback after TTS ends via a new `_pendingMotion` slot symmetric to the existing `_pending` (emotion).

**Tech Stack:** `@pixiv/three-vrm-animation` (new), Three.js AnimationMixer, TypeScript. No test runner — verify each task with `cd character && npm run typecheck` or `cd EmoMate && npx tsc --noEmit` (must produce zero errors).

> **Prerequisite:** `docs/superpowers/plans/2026-04-24-motion-coordinator.md` is complete. `MotionCoordinator.ts` exists with `onAIAction`, `onTTSStart`, `onTTSEnd`, module-level `_pending` / `_state` variables, and `parseVRMAction` returns `{ intent: { emotion: string } | null, cleanText, hasPartialTag }`.

---

## Current State (verified 2026-04-26)

| Item | Status | Notes |
|------|--------|-------|
| VRMA files | ✅ Done | `character/public/assets/vrma/VRMA_0[1-7].vrma` |
| `@pixiv/three-vrm-animation` | ❌ Not installed | only `@pixiv/three-vrm` is present |
| `VRMCommand` in `EmoMate/src/types/vrm.ts` | ✅ Done | already includes `'playVRMA'` |
| `VRMBridgeCommand.playVRMA` in `vrm-bridge.ts` | ⚠️ Wrong shape | exists as `{ url: string; loop?: boolean }` — must change to `{ name: string }` |
| `ExpressionController` `case 'playVRMA':` | ⚠️ Stub only | `console.warn` placeholder, no real implementation |
| `VRMAPlayer.ts` | ❌ Not created | |
| `vrmaManifest.ts` | ❌ Not created | |
| `parseVRMAction.ts` discriminated union | ❌ Not done | still `{ emotion: string }` only |
| `MotionCoordinator` motion support | ❌ Not done | no `_pendingMotion`, no `onAIMotion` |
| `useChatAI.ts` motion dispatch | ❌ Not done | |
| `ai.ts` motion prompt rules | ❌ Not done | |
| `HomeScreen.tsx` debug buttons | ❌ Not done | |

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `character/package.json` | Modify | Add `@pixiv/three-vrm-animation` dependency |
| `character/app/components/VRMAPlayer.ts` | **Create** | Encapsulates VRMA load + Three.js AnimationMixer playback |
| `character/app/components/vrmaManifest.ts` | **Create** | Maps motion name → file path for all 7 clips |
| `character/app/types/vrm-bridge.ts` | Modify | Change `playVRMA` data shape from `{ url }` to `{ name }` |
| `character/app/components/ExpressionController.tsx` | Modify | Replace stub with VRMAPlayer integration |
| `EmoMate/src/types/vrm.ts` | Modify | Add `VRMAMotionName` type (VRMCommand already has `playVRMA`) |
| `EmoMate/src/utils/parseVRMAction.ts` | Modify | Extend `ActionIntent` to discriminated union; parse `{ motion }` |
| `EmoMate/src/capabilities/motion/MotionCoordinator.ts` | Modify | Add `_pendingMotion` + `onAIMotion()`; update `onTTSEnd` and `reset` |
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

Create `character/app/components/VRMAPlayer.ts`:

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
- Modify: `character/app/types/vrm-bridge.ts`
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

// VRoid official free VRMA pack (7 clips)
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

- [ ] **Step 2: Fix VRMBridgeCommand.playVRMA shape in vrm-bridge.ts**

> **Context:** `playVRMA` already exists in `VRMBridgeCommand` but with `{ url: string; loop?: boolean }`. Change it to `{ name: string }` so EmoMate sends a name and the character looks up the URL from `vrmaManifest`.

Open `character/app/types/vrm-bridge.ts`. Find:

```typescript
  | { type: 'playVRMA'; data: { url: string; loop?: boolean } };
```

Replace with:

```typescript
  | { type: 'playVRMA'; data: { name: string } };
```

- [ ] **Step 3: Add imports to ExpressionController.tsx**

Open `character/app/components/ExpressionController.tsx`. Find the last import line and add two more lines directly after it:

```typescript
import { VRMAPlayer } from './VRMAPlayer';
import { VRMA_MANIFEST, VRMAMotionName } from './vrmaManifest';
```

- [ ] **Step 4: Add VRMA refs**

Inside `ExpressionController`, find:

```typescript
const idleReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Add two new refs directly after it:

```typescript
const vrmaPlayer = useRef<VRMAPlayer | null>(null);
const vrmaClips = useRef<Map<string, THREE.AnimationClip>>(new Map());
```

- [ ] **Step 5: Add VRMA mount useEffect**

Add a new `useEffect` immediately after the existing message-listener effect:

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

- [ ] **Step 6: Replace the playVRMA stub**

Find the existing stub (around line 297):

```typescript
        case 'playVRMA':
          // Reserved for future VRMA clip support.
          // Implement by loading and playing a .vrma file via @pixiv/three-vrm-animation.
          console.warn('[ExpressionController] playVRMA not yet implemented:', cmd.data);
          break;
```

Replace it with:

```typescript
        case 'playVRMA': {
          const clip = vrmaClips.current.get((cmd.data as { name: string }).name);
          if (!clip || !vrmaPlayer.current) break;
          presetState.current = { name: null, elapsed: 0, loop: false };
          vrmaPlayer.current.play(clip, () => {
            presetState.current = { name: 'idle', elapsed: 0, loop: true };
          });
          break;
        }
```

- [ ] **Step 7: Add update() call in useFrame**

Inside `useFrame`, find:

```typescript
    if (em) em.update();
    vrm.update(delta);
```

Insert `vrmaPlayer.current?.update(delta);` between them:

```typescript
    if (em) em.update();
    vrmaPlayer.current?.update(delta);
    vrm.update(delta);
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
        character/app/types/vrm-bridge.ts \
        character/app/components/ExpressionController.tsx
git commit -m "feat(character): integrate VRMAPlayer into ExpressionController"
```

---

## Task 4: EmoMate — Add VRMAMotionName type + extend parseVRMAction

**Files:**
- Modify: `EmoMate/src/types/vrm.ts`
- Modify: `EmoMate/src/utils/parseVRMAction.ts`

> **Note:** `VRMCommand.type` already includes `'playVRMA'`. Only need to add the `VRMAMotionName` union type and update `parseVRMAction`.

- [ ] **Step 1: Add VRMAMotionName to vrm.ts**

Open `EmoMate/src/types/vrm.ts`. Find the `VRMCommand` interface and add the new type **above** it:

```typescript
export type VRMAMotionName =
  | 'full_pose'
  | 'greeting'
  | 'v_sign'
  | 'photo_pose'
  | 'spin'
  | 'model_pose'
  | 'crouch';
```

(`VRMCommand` already has `'playVRMA'` in its type union — no further change needed.)

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
      // malformed JSON — discard tag but still strip it from text
    }
  }
  let cleanText = text.replace(/<action>[\s\S]*?<\/action>/g, '').trim();

  let hasPartialTag = false;
  const partialStart = cleanText.lastIndexOf('<action>');
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

Expected: errors in `useChatAI.ts` about `intent.emotion` (because `intent` is now a discriminated union) — these are **expected** and will be fixed in Task 6.

- [ ] **Step 4: Commit**

```bash
git add EmoMate/src/types/vrm.ts EmoMate/src/utils/parseVRMAction.ts
git commit -m "feat(EmoMate): add VRMAMotionName and extend parseVRMAction discriminated union"
```

---

## Task 5: EmoMate — Extend MotionCoordinator with VRMA support

**Files:**
- Modify: `EmoMate/src/capabilities/motion/MotionCoordinator.ts`

> **IMPORTANT — Architecture:** `MotionCoordinator.ts` uses **module-level variables** (not a class). All new code must follow that pattern: module-level `let _pendingMotion`, and `onAIMotion` added as a property of the exported `motionCoordinator` object. Do NOT use `this.` anywhere.

- [ ] **Step 1: Add _pendingMotion module variable**

Open `EmoMate/src/capabilities/motion/MotionCoordinator.ts`. Find the existing module-level variable declarations:

```typescript
let _handler: VRMCommandFn | null = null;
let _state: CoordState = 'Idle';
let _pending: string | null = null;      // emotion waiting for TTS to end
let _postTimer: ReturnType<typeof setTimeout> | null = null;
let _camTimer:  ReturnType<typeof setTimeout> | null = null;
```

Add one line after `_pending`:

```typescript
let _pendingMotion: string | null = null; // VRMA motion name waiting for TTS to end
```

- [ ] **Step 2: Add VRMAMotionName import**

At the top of the file, add:

```typescript
import { VRMAMotionName } from '../../types/vrm';
```

- [ ] **Step 3: Update reset() to clear _pendingMotion**

Find the `reset()` method:

```typescript
  reset(): void {
    clearPostTimer();
    clearCamTimer();
    _state = 'Idle';
    _pending = null;
    sendPreset('idle');
  },
```

Add `_pendingMotion = null;` after `_pending = null;`:

```typescript
  reset(): void {
    clearPostTimer();
    clearCamTimer();
    _state = 'Idle';
    _pending = null;
    _pendingMotion = null;
    sendPreset('idle');
  },
```

- [ ] **Step 4: Update onTTSEnd() to check _pendingMotion first**

Find the `onTTSEnd()` method:

```typescript
  onTTSEnd(): void {
    if (!isTTSActive(_state)) return;
    if (_pending) {
      const emotion = _pending;
      _pending = null;
      _state = { tag: 'PostTTS_Emotion', emotion };
      playEmotionThenIdle(emotion);
    } else {
      _state = 'Idle';
      sendPreset('idle');
    }
  },
```

Replace with (add `_pendingMotion` check **before** the `_pending` check):

```typescript
  onTTSEnd(): void {
    if (!isTTSActive(_state)) return;
    if (_pendingMotion) {
      const name = _pendingMotion;
      _pendingMotion = null;
      _pending = null;
      _state = 'Idle';
      send({ type: 'playVRMA', data: { name } });
      return;
    }
    if (_pending) {
      const emotion = _pending;
      _pending = null;
      _state = { tag: 'PostTTS_Emotion', emotion };
      playEmotionThenIdle(emotion);
    } else {
      _state = 'Idle';
      sendPreset('idle');
    }
  },
```

- [ ] **Step 5: Add onAIMotion() to the motionCoordinator object**

Find the `onAIAction` method in the `motionCoordinator` export. Add `onAIMotion` directly after it:

```typescript
  onAIMotion(motionName: VRMAMotionName): void {
    if (isTTSActive(_state) || _state === 'Thinking') {
      _pendingMotion = motionName;
      _pending = null; // motion takes priority over any queued emotion
    } else {
      _state = 'Idle';
      send({ type: 'playVRMA', data: { name: motionName } });
    }
  },
```

- [ ] **Step 6: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit
```

Expected: zero errors (or only the pre-existing `useChatAI.ts` errors from Task 4).

- [ ] **Step 7: Commit**

```bash
git add EmoMate/src/capabilities/motion/MotionCoordinator.ts
git commit -m "feat(EmoMate): add _pendingMotion and onAIMotion to MotionCoordinator"
```

---

## Task 6: EmoMate — Wire useChatAI + update AI prompt

**Files:**
- Modify: `EmoMate/src/hooks/useChatAI.ts`
- Modify: `EmoMate/src/constants/ai.ts`

- [ ] **Step 1: Update the action dispatch in useChatAI.ts**

Open `EmoMate/src/hooks/useChatAI.ts`. Find the block that handles `intent` from `parseVRMAction`. It currently looks like:

```typescript
const { intent, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
if (intent) {
  const STORE_EMOTION_MAP: Record<string, string> = { laugh: 'joy', sad: 'sadness' };
  const storeEmotion = STORE_EMOTION_MAP[intent.emotion] ?? intent.emotion;
  useEmotionStore.getState().setTextEmotion(storeEmotion as EmotionType);
  motionCoordinator.onAIAction(intent.emotion);
  pendingHint = intent.emotion;
  debugLog('ChatAI', 'AI action dispatched', intent);
}
```

Replace the `if (intent)` block with a discriminated check:

```typescript
              const { intent, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
              if (intent?.type === 'emotion') {
                const STORE_EMOTION_MAP: Record<string, string> = { laugh: 'joy', sad: 'sadness' };
                const storeEmotion = STORE_EMOTION_MAP[intent.emotion] ?? intent.emotion;
                useEmotionStore.getState().setTextEmotion(storeEmotion as EmotionType);
                motionCoordinator.onAIAction(intent.emotion);
                pendingHint = intent.emotion;
                debugLog('ChatAI', 'AI action dispatched', intent);
              } else if (intent?.type === 'motion') {
                motionCoordinator.onAIMotion(intent.motion);
                debugLog('ChatAI', 'AI motion dispatched', intent);
              }
```

- [ ] **Step 2: Add motion action rules to the system prompt in ai.ts**

Open `EmoMate/src/constants/ai.ts`. Find the `<action>` format rules in the system prompt (the block describing emotion action format). Append the following directly after the emotion action rules:

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

Motion rules: max 1 motion action per reply; do not combine motion and emotion actions in the same reply; only use when the user explicitly requests a pose or movement.
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

Open `EmoMate/src/screens/HomeScreen.tsx`. Add `ScrollView` and `TouchableOpacity` to the React Native import if not already present. Also add:

```typescript
import { isDebugMode } from '../utils/debug';
import { VRMAMotionName } from '../types/vrm';
import { motionCoordinator } from '../capabilities/motion';
```

- [ ] **Step 2: Add the label constant**

At module level (outside the component), add:

```typescript
const VRMA_MOTION_LABELS: Record<VRMAMotionName, string> = {
  full_pose:  '全身照',
  greeting:   '问候',
  v_sign:     'V字',
  photo_pose: '拍照',
  spin:       '旋转',
  model_pose: '模特',
  crouch:     '蹲姿',
};
```

- [ ] **Step 3: Add the debug button row to the JSX**

Find where other debug UI is rendered (look for `{isDebugMode() && ...}`). Add the following block:

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
- [ ] Tap each of the 7 buttons; confirm the matching animation plays and character returns to idle
- [ ] Say "转一圈" — confirm spin plays after AI finishes speaking (not during TTS)
- [ ] Say "比个V" — confirm v_sign plays after TTS ends
- [ ] Say "打个招呼" — confirm greeting plays; should NOT conflict with the speaking animation
- [ ] Verify that during a VRMA clip, `playPreset` from camera emotion is ignored (coordinator is in Idle after VRMA, so camera emotion only fires when truly idle)

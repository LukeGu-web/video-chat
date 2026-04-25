# VRMA Animation Support Design

**Date**: 2026-04-25
**Status**: Approved
**Scope**: character WebApp + EmoMate

---

## Problem

The current motion system uses hand-written keyframe presets (`motionPresets.ts`) with linear interpolation in `ExpressionController`. This has three fundamental limitations:

- **Upper body only**: `BoneMap` covers head/neck/spine/arms — no hips/legs/feet
- **Rotation only**: No positional displacement — no jumping, running, weight shift
- **Manual authoring is laborious and stiff**: A dance routine needs 30+ keyframes and still feels mechanical

Complex full-body actions (dance, run, spin) cannot be achieved with the keyframe system.

---

## Solution

Integrate `.vrma` (VRM 1.0 official animation format) support via `@pixiv/three-vrm-animation`. VRMA drives all humanoid bones including lower body with full positional displacement, and is compatible with any VRM 1.0 model.

The existing `playVRMA` extension point in the MotionCoordinator design (`2026-04-24-motion-coordinator-design.md`) is now fully specified here.

---

## VRMA Asset Manifest

Seven clips purchased from Booth (VRM 1.0 compatible):

| File | Motion ID | Description | Duration |
|---|---|---|---|
| VRMA_01.vrma | `full_pose` | Full body showcase pose | 11.8s |
| VRMA_02.vrma | `greeting` | Greeting / welcome | 7.3s |
| VRMA_03.vrma | `v_sign` | V-sign hand gesture | 11.7s |
| VRMA_04.vrma | `photo_pose` | Camera/photo pose | 9.6s |
| VRMA_05.vrma | `spin` | Full body spin/twirl | 9.3s |
| VRMA_06.vrma | `model_pose` | Model runway pose | 7.5s |
| VRMA_07.vrma | `crouch` | Crouching pose | 11.5s |

Files live at: `character/public/assets/vrma/VRMA_0{1-7}.vrma`

---

## Architecture

### Data Flow

```
User: "转一圈吧"
    ↓
useChatAI.ts receives stream:
  "好的！<action>{"motion":"spin"}</action>给你转一圈！"
    ↓
parseVRMAction.ts → { type: 'motion', motion: 'spin' }
    ↓
coordinator.onAIMotion('spin')
  → TTS in progress → pendingMotion = 'spin'
    ↓
TTS plays "好的！给你转一圈！"
    ↓
onTTSEnd() → pendingMotion exists
  → sendCommand({ type: 'playVRMA', data: { name: 'spin' } })
  → pendingMotion = null
    ↓
ExpressionController receives playVRMA
  → suspends preset, plays spin.vrma via VRMAPlayer
  → on finish → resumes idle preset
```

### Trigger Policy

VRMA is **user-initiated only** — triggered by AI `<action>{"motion":"..."}` tags in response to explicit user requests. VRMA is never auto-triggered by TTS state or camera emotion. When TTS is active at trigger time, VRMA is queued and plays after TTS ends. If idle, it plays immediately.

---

## Section 1: `<action>` Schema Extension

### New `motion` type (parallel to existing `emotion` type)

```
<action>{"emotion":"joy"}</action>    ← existing, unchanged
<action>{"motion":"spin"}</action>    ← new
```

One `<action>` per reply. `motion` and `emotion` are mutually exclusive in the same reply.

### `parseVRMAction.ts` updated return type

```typescript
export type VRMAMotionName =
  | 'full_pose' | 'greeting' | 'v_sign'
  | 'photo_pose' | 'spin' | 'model_pose' | 'crouch';

export type ActionIntent =
  | { type: 'emotion'; emotion: EmotionType }
  | { type: 'motion';  motion: VRMAMotionName };

// When motion intent parsed:
//   coordinator.onAIMotion(intent.motion)
//   pendingEmotion cleared to null (mutually exclusive)
// When emotion intent parsed:
//   coordinator.onAIAction(intent.emotion)  (existing)
//   pendingMotion cleared to null
```

### AI Prompt addition (`constants/ai.ts`)

```
When the user asks you to pose, gesture, or move, insert a motion <action> tag before the response:

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

Rules:
- Max 1 motion action per reply
- Do not combine motion and emotion actions in the same reply
- Only use when the user explicitly requests a pose or movement
```

---

## Section 2: MotionCoordinator Changes

Minimal symmetric extension of the existing `pendingEmotion` pattern.

### New field and method

```typescript
// MotionCoordinator.ts additions
private pendingMotion: VRMAMotionName | null = null;

onAIMotion(motionName: VRMAMotionName): void {
  const speaking = ['TTS_Speaking', 'TTS_Laughing', 'TTS_Emotion'].includes(this.state);
  if (speaking) {
    this.pendingMotion = motionName;
  } else {
    this.sendCommand({ type: 'playVRMA', data: { name: motionName } });
  }
}
```

### `onTTSEnd()` update (pendingMotion checked first)

```typescript
onTTSEnd(): void {
  if (this.pendingMotion) {
    const name = this.pendingMotion;
    this.pendingMotion = null;
    this.sendCommand({ type: 'playVRMA', data: { name } });
    this.setState('Idle');
    return;
  }
  if (this.pendingEmotion) {
    // existing logic unchanged
  }
  this.sendCommand({ type: 'playPreset', data: { name: 'idle' } });
  this.setState('Idle');
}
```

### `vrm-bridge.ts` new command type

```typescript
| { type: 'playVRMA'; data: { name: string } }
```

---

## Section 3: Character Side — VRMA Player

### New file: `character/app/components/VRMAPlayer.ts`

Encapsulates VRMA loading and playback. Keeps `ExpressionController` clean.

```typescript
import { VRM } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, VRMAnimation, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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

### New file: `character/app/components/vrmaManifest.ts`

```typescript
export type VRMAMotionName =
  | 'full_pose' | 'greeting' | 'v_sign'
  | 'photo_pose' | 'spin' | 'model_pose' | 'crouch';

export const VRMA_MANIFEST: Record<VRMAMotionName, string> = {
  full_pose:  '/assets/vrma/VRMA_01.vrma',
  greeting:   '/assets/vrma/VRMA_02.vrma',
  v_sign:     '/assets/vrma/VRMA_03.vrma',
  photo_pose: '/assets/vrma/VRMA_04.vrma',
  spin:       '/assets/vrma/VRMA_05.vrma',
  model_pose: '/assets/vrma/VRMA_06.vrma',
  crouch:     '/assets/vrma/VRMA_07.vrma',
};

export const VRMA_MOTION_LABELS: Record<VRMAMotionName, string> = {
  full_pose:  '全身照',
  greeting:   '问候',
  v_sign:     'V字',
  photo_pose: '拍摄',
  spin:       '旋转',
  model_pose: '模特',
  crouch:     '蹲姿',
};
```

### `ExpressionController.tsx` changes

```typescript
// Added refs
const vrmaPlayer = useRef<VRMAPlayer | null>(null);
const vrmaClips = useRef<Map<string, THREE.AnimationClip>>(new Map());

// Mount: initialize player and preload all clips in background
useEffect(() => {
  const player = new VRMAPlayer(vrm);
  vrmaPlayer.current = player;
  Object.entries(VRMA_MANIFEST).forEach(([name, url]) => {
    player.load(url).then(clip => {
      vrmaClips.current.set(name, clip);
    });
  });
}, [vrm]);

// New message handler case
case 'playVRMA': {
  const clip = vrmaClips.current.get(cmd.data.name);
  if (!clip || !vrmaPlayer.current) break;
  presetState.current = { name: null, elapsed: 0, loop: false }; // suspend preset
  vrmaPlayer.current.play(clip, () => {
    presetState.current = { name: 'idle', elapsed: 0, loop: true };
  });
  break;
}

// useFrame: add at end, before vrm.update()
vrmaPlayer.current?.update(delta);
```

Priority mechanism: setting `presetState.name = null` naturally suspends the keyframe preset system. No changes to the existing priority guard required.

---

## Section 4: Debug UI

In `HomeScreen.tsx` debug region — a horizontally scrollable button row, bypassing the coordinator for direct clip testing:

```typescript
{isDebugMode() && (
  <ScrollView horizontal style={styles.vrmaDebugRow}>
    {(Object.entries(VRMA_MOTION_LABELS) as [VRMAMotionName, string][]).map(([name, label]) => (
      <TouchableOpacity
        key={name}
        style={styles.vrmaDebugBtn}
        onPress={() => characterRef.current?.sendCommand({
          type: 'playVRMA',
          data: { name }
        })}
      >
        <Text style={styles.vrmaDebugBtnText}>{label}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
)}
```

---

## Files Changed

| File | Change | Content |
|---|---|---|
| `character/package.json` | Modify | Add `@pixiv/three-vrm-animation` dependency |
| `character/app/components/VRMAPlayer.ts` | **New** | VRMA load + playback class |
| `character/app/components/vrmaManifest.ts` | **New** | Clip path + label manifest |
| `character/app/components/ExpressionController.tsx` | Modify | Mount VRMAPlayer, preload clips, handle `playVRMA` |
| `character/app/types/vrm-bridge.ts` | Modify | Add `playVRMA` command + `VRMAMotionName` type |
| `EmoMate/src/utils/parseVRMAction.ts` | Modify | Support `{ motion }` intent type |
| `EmoMate/src/capabilities/motion/MotionCoordinator.ts` | Modify | Add `pendingMotion` + `onAIMotion()` |
| `EmoMate/src/constants/ai.ts` | Modify | Add motion action prompt rules |
| `EmoMate/src/screens/HomeScreen.tsx` | Modify | Add VRMA debug button row |

---

## Work Estimate

| Task | Time |
|---|---|
| character: VRMAPlayer + ExpressionController integration | 1 day |
| EmoMate: parser + coordinator + AI prompt | 0.5 day |
| Debug buttons + integration testing | 0.5 day |
| **Total** | **~2 days** |

---

## Out of Scope

- Looping VRMA clips (all clips play once then return to idle)
- Blending between VRMA and keyframe presets at the bone level
- User-uploaded or runtime-downloaded VRMA files
- More than 7 clips in the initial release

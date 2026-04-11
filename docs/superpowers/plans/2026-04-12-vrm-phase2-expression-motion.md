# VRM Phase 2 — Expression & Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable EmoMate to control the VRM character's facial expressions (blend shapes) and body poses (bone rotations) via the WebView bridge. Replace the Live2D 11-motion system with a VRM-native expression + pose system.

**Architecture:** Add an `ExpressionController` component inside the R3F `<Canvas>` that listens to `window` message events (posted by the WebView bridge) and applies blend shape weights + bone rotations to the VRM model each frame via `useFrame`. On the EmoMate side, rewrite `motionMapper.ts` to emit VRM bridge commands instead of Live2D motion name strings.

**Tech Stack:** `@pixiv/three-vrm` (VRMExpressionManager, VRMHumanoid), React Three Fiber `useFrame`, Zustand, TypeScript

---

## Task 1: Create Shared VRM Types

**Files:**
- Create: `character/app/types/vrm-bridge.ts`

- [ ] **Step 1: Create the types file**

```typescript
// character/app/types/vrm-bridge.ts

export interface BlendShapeMap {
  joy?: number;
  angry?: number;
  sorrow?: number;
  fun?: number;
  surprised?: number;
  neutral?: number;
  blink?: number;
  blinkLeft?: number;
  blinkRight?: number;
  // Visemes (Phase 3)
  aa?: number;
  ee?: number;
  ih?: number;
  oh?: number;
  ou?: number;
}

export interface BoneRotation {
  x?: number;  // radians
  y?: number;
  z?: number;
}

export interface BoneMap {
  head?: BoneRotation;
  neck?: BoneRotation;
  spine?: BoneRotation;
  chest?: BoneRotation;
  leftUpperArm?: BoneRotation;
  leftLowerArm?: BoneRotation;
  rightUpperArm?: BoneRotation;
  rightLowerArm?: BoneRotation;
  leftHand?: BoneRotation;
  rightHand?: BoneRotation;
}

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

// Commands sent from EmoMate → WebView
export type VRMBridgeCommand =
  | { type: 'playPreset'; data: { name: PresetName; loop?: boolean } }
  | { type: 'setExpression'; data: { blendShapes: BlendShapeMap; duration?: number } }
  | { type: 'playPose'; data: { blendShapes?: BlendShapeMap; bones?: BoneMap; duration?: number; easing?: EasingType } }
  | { type: 'stopAll' }
  | { type: 'ping' };

export type PresetName =
  | 'idle'
  | 'speaking'
  | 'thinking'
  | 'wave'
  | 'shy'
  | 'excited'
  | 'surprised'
  | 'happy'
  | 'sleepy';
```

- [ ] **Step 2: Commit**

```bash
cd character
git add app/types/vrm-bridge.ts
git commit -m "feat: add VRM bridge type definitions"
```

---

## Task 2: Create Motion Presets

**Files:**
- Create: `character/app/components/motionPresets.ts`

- [ ] **Step 1: Create the presets file**

```typescript
// character/app/components/motionPresets.ts

import { BoneMap, BlendShapeMap, PresetName } from '../types/vrm-bridge';

export interface Keyframe {
  time: number;       // seconds from start
  bones?: BoneMap;
  blendShapes?: BlendShapeMap;
}

export interface MotionPreset {
  name: PresetName;
  keyframes: Keyframe[];
  loop: boolean;
  loopDuration?: number;  // for loop presets, total cycle duration
}

export const MOTION_PRESETS: Record<PresetName, MotionPreset> = {
  idle: {
    name: 'idle',
    loop: true,
    loopDuration: 4.0,
    keyframes: [
      { time: 0.0,  bones: { spine: { x: 0 } } },
      { time: 1.0,  bones: { spine: { x: 0.02 }, head: { y: 0.03 } } },
      { time: 2.0,  bones: { spine: { x: 0.03 }, head: { y: 0 } } },
      { time: 3.0,  bones: { spine: { x: 0.02 }, head: { y: -0.03 } } },
      { time: 4.0,  bones: { spine: { x: 0 } } },
    ],
  },

  speaking: {
    name: 'speaking',
    loop: true,
    loopDuration: 2.0,
    keyframes: [
      { time: 0.0,  bones: { head: { x: 0 }, spine: { x: 0 } } },
      { time: 0.5,  bones: { head: { x: 0.03 }, spine: { x: 0.02 } } },
      { time: 1.0,  bones: { head: { x: 0 }, spine: { x: 0.03 } } },
      { time: 1.5,  bones: { head: { x: -0.02 }, spine: { x: 0.02 } } },
      { time: 2.0,  bones: { head: { x: 0 }, spine: { x: 0 } } },
    ],
  },

  thinking: {
    name: 'thinking',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { head: { z: 0, x: 0 } } },
      { time: 0.8, bones: {
        head: { z: 0.15, x: 0.05 },
        rightUpperArm: { x: -0.4, z: -0.1 },
        rightLowerArm: { x: 1.0 },
      }},
    ],
  },

  wave: {
    name: 'wave',
    loop: false,
    keyframes: [
      { time: 0.0,  bones: { rightUpperArm: { x: 0, z: 0 } } },
      { time: 0.4,  bones: { rightUpperArm: { x: -1.2, z: -0.5 }, rightLowerArm: { x: 0.3 } } },
      { time: 0.8,  bones: { rightUpperArm: { x: -1.2, z: -0.5 }, rightHand: { z: 0.3 } } },
      { time: 1.2,  bones: { rightUpperArm: { x: -1.2, z: -0.5 }, rightHand: { z: -0.3 } } },
      { time: 1.6,  bones: { rightUpperArm: { x: -1.2, z: -0.5 }, rightHand: { z: 0.3 } } },
      { time: 2.0,  bones: { rightUpperArm: { x: -1.2, z: -0.5 }, rightHand: { z: 0 } } },
      { time: 2.6,  bones: { rightUpperArm: { x: 0, z: 0 }, rightLowerArm: { x: 0 } } },
    ],
  },

  shy: {
    name: 'shy',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { head: { x: 0, z: 0 } } },
      { time: 0.8, bones: {
        head: { x: 0.2, z: -0.1 },
        leftUpperArm: { x: -0.3, z: 0.4 },
        rightUpperArm: { x: -0.3, z: -0.4 },
        leftLowerArm: { x: 0.5 },
        rightLowerArm: { x: 0.5 },
      }, blendShapes: { joy: 0.3 } },
    ],
  },

  excited: {
    name: 'excited',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { spine: { x: 0 } } },
      { time: 0.3, bones: {
        spine: { x: 0.1 },
        leftUpperArm: { x: -0.5, z: 0.8 },
        rightUpperArm: { x: -0.5, z: -0.8 },
      }, blendShapes: { joy: 0.8 } },
      { time: 0.7, bones: {
        spine: { x: 0.05 },
        leftUpperArm: { x: -0.3, z: 0.5 },
        rightUpperArm: { x: -0.3, z: -0.5 },
      }},
      { time: 1.2, bones: { spine: { x: 0.1 } } },
    ],
  },

  surprised: {
    name: 'surprised',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { head: { x: 0 }, spine: { x: 0 } } },
      { time: 0.3, bones: {
        head: { x: -0.1 },
        spine: { x: -0.05 },
        leftUpperArm: { z: 0.3 },
        rightUpperArm: { z: -0.3 },
      }, blendShapes: { surprised: 0.9 } },
      { time: 1.5, bones: { head: { x: 0 }, spine: { x: 0 } }, blendShapes: { surprised: 0 } },
    ],
  },

  happy: {
    name: 'happy',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { spine: { x: 0 } }, blendShapes: { joy: 0 } },
      { time: 0.25, bones: { spine: { x: 0.05 }, head: { y: 0.05 } }, blendShapes: { joy: 0.8 } },
      { time: 0.5,  bones: { spine: { x: 0 }, head: { y: -0.05 } } },
      { time: 0.75, bones: { spine: { x: 0.04 }, head: { y: 0.04 } } },
      { time: 1.0,  bones: { spine: { x: 0 }, head: { y: 0 } } },
      { time: 1.5,  blendShapes: { joy: 0 } },
    ],
  },

  sleepy: {
    name: 'sleepy',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { head: { x: 0 } }, blendShapes: { sorrow: 0 } },
      { time: 2.0, bones: {
        head: { x: 0.25 },
        spine: { x: 0.08 },
      }, blendShapes: { sorrow: 0.3 } },
    ],
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add app/components/motionPresets.ts
git commit -m "feat: add VRM motion presets (idle, wave, thinking, etc.)"
```

---

## Task 3: Create ExpressionController Component

**Files:**
- Create: `character/app/components/ExpressionController.tsx`

- [ ] **Step 1: Create the controller**

```tsx
// character/app/components/ExpressionController.tsx

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { VRMBridgeCommand, BlendShapeMap, BoneMap, EasingType } from '../types/vrm-bridge';
import { MOTION_PRESETS, Keyframe } from './motionPresets';

// ─── Easing functions ─────────────────────────────────────────────────────────

const easings: Record<EasingType, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
};

// ─── VRM name helpers ─────────────────────────────────────────────────────────

const VRM_EXPRESSION_MAP: Record<string, string> = {
  joy: VRMExpressionPresetName.Happy,
  angry: VRMExpressionPresetName.Angry,
  sorrow: VRMExpressionPresetName.Sad,
  fun: VRMExpressionPresetName.Relaxed,
  surprised: VRMExpressionPresetName.Surprised,
  neutral: VRMExpressionPresetName.Neutral,
  blink: VRMExpressionPresetName.Blink,
  blinkLeft: VRMExpressionPresetName.BlinkLeft,
  blinkRight: VRMExpressionPresetName.BlinkRight,
  aa: VRMExpressionPresetName.Aa,
  ee: VRMExpressionPresetName.Ee,
  ih: VRMExpressionPresetName.Ih,
  oh: VRMExpressionPresetName.Oh,
  ou: VRMExpressionPresetName.Ou,
};

const BONE_NAME_MAP: Record<string, string> = {
  head: 'head',
  neck: 'neck',
  spine: 'spine',
  chest: 'chest',
  leftUpperArm: 'leftUpperArm',
  leftLowerArm: 'leftLowerArm',
  rightUpperArm: 'rightUpperArm',
  rightLowerArm: 'rightLowerArm',
  leftHand: 'leftHand',
  rightHand: 'rightHand',
};

// ─── State types ──────────────────────────────────────────────────────────────

interface AnimationState {
  targetBlendShapes: BlendShapeMap;
  currentBlendShapes: BlendShapeMap;
  targetBones: BoneMap;
  currentBones: BoneMap;
  transitionDuration: number;
  transitionElapsed: number;
  easing: EasingType;
  isAnimating: boolean;
}

interface PresetState {
  name: string | null;
  elapsed: number;
  loop: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ExpressionControllerProps {
  vrm: VRM;
}

export function ExpressionController({ vrm }: ExpressionControllerProps) {
  const animState = useRef<AnimationState>({
    targetBlendShapes: {},
    currentBlendShapes: {},
    targetBones: {},
    currentBones: {},
    transitionDuration: 0.5,
    transitionElapsed: 0,
    easing: 'easeInOut',
    isAnimating: false,
  });

  const presetState = useRef<PresetState>({ name: 'idle', elapsed: 0, loop: true });
  const blinkTimer = useRef(0);
  const nextBlinkTime = useRef(2.0);

  // ─── Apply blend shape to VRM ──────────────────────────────────────────────

  const applyBlendShapes = (shapes: BlendShapeMap) => {
    const em = vrm.expressionManager;
    if (!em) return;
    for (const [key, value] of Object.entries(shapes)) {
      const vrmName = VRM_EXPRESSION_MAP[key];
      if (vrmName && value !== undefined) {
        em.setValue(vrmName, Math.max(0, Math.min(1, value)));
      }
    }
    em.update();
  };

  // ─── Apply bone rotations to VRM ───────────────────────────────────────────

  const applyBones = (bones: BoneMap) => {
    const humanoid = vrm.humanoid;
    if (!humanoid) return;
    for (const [boneName, rotation] of Object.entries(bones)) {
      const vrmBoneName = BONE_NAME_MAP[boneName];
      if (!vrmBoneName || !rotation) continue;
      const bone = humanoid.getNormalizedBoneNode(vrmBoneName as any);
      if (!bone) continue;
      if (rotation.x !== undefined) bone.rotation.x = rotation.x;
      if (rotation.y !== undefined) bone.rotation.y = rotation.y;
      if (rotation.z !== undefined) bone.rotation.z = rotation.z;
    }
  };

  // ─── Interpolate blend shapes ──────────────────────────────────────────────

  const lerpBlendShapes = (from: BlendShapeMap, to: BlendShapeMap, t: number): BlendShapeMap => {
    const result: BlendShapeMap = { ...from };
    for (const key of Object.keys(to) as Array<keyof BlendShapeMap>) {
      const fromVal = from[key] ?? 0;
      const toVal = to[key] ?? 0;
      (result as any)[key] = fromVal + (toVal - fromVal) * t;
    }
    return result;
  };

  const lerpBones = (from: BoneMap, to: BoneMap, t: number): BoneMap => {
    const result: BoneMap = { ...from };
    for (const boneName of Object.keys(to) as Array<keyof BoneMap>) {
      const fromRot = from[boneName] ?? {};
      const toRot = to[boneName] ?? {};
      (result as any)[boneName] = {
        x: THREE.MathUtils.lerp(fromRot.x ?? 0, toRot.x ?? 0, t),
        y: THREE.MathUtils.lerp(fromRot.y ?? 0, toRot.y ?? 0, t),
        z: THREE.MathUtils.lerp(fromRot.z ?? 0, toRot.z ?? 0, t),
      };
    }
    return result;
  };

  // ─── Bridge message handler ────────────────────────────────────────────────

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let cmd: VRMBridgeCommand;
      try {
        cmd = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      const state = animState.current;

      switch (cmd.type) {
        case 'setExpression':
          state.targetBlendShapes = cmd.data.blendShapes;
          state.transitionDuration = cmd.data.duration ?? 0.5;
          state.transitionElapsed = 0;
          state.easing = 'easeInOut';
          state.isAnimating = true;
          break;

        case 'playPose':
          if (cmd.data.blendShapes) {
            state.targetBlendShapes = cmd.data.blendShapes;
          }
          if (cmd.data.bones) {
            state.targetBones = cmd.data.bones;
          }
          state.transitionDuration = cmd.data.duration ?? 1.0;
          state.transitionElapsed = 0;
          state.easing = cmd.data.easing ?? 'easeInOut';
          state.isAnimating = true;
          presetState.current = { name: null, elapsed: 0, loop: false };
          break;

        case 'playPreset': {
          const preset = MOTION_PRESETS[cmd.data.name];
          if (preset) {
            presetState.current = {
              name: cmd.data.name,
              elapsed: 0,
              loop: cmd.data.loop ?? preset.loop,
            };
          }
          break;
        }

        case 'stopAll':
          presetState.current = { name: 'idle', elapsed: 0, loop: true };
          state.targetBlendShapes = {};
          state.targetBones = {};
          state.transitionDuration = 0.5;
          state.transitionElapsed = 0;
          state.isAnimating = true;
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ─── Per-frame update ──────────────────────────────────────────────────────

  useFrame((_, delta) => {
    const state = animState.current;
    const preset = presetState.current;

    // Auto-blink
    blinkTimer.current += delta;
    if (blinkTimer.current >= nextBlinkTime.current) {
      blinkTimer.current = 0;
      nextBlinkTime.current = 0.5 + Math.random() * 3.5;
      applyBlendShapes({ blink: 1 });
      setTimeout(() => applyBlendShapes({ blink: 0 }), 120);
    }

    // Preset animation
    if (preset.name) {
      const presetDef = MOTION_PRESETS[preset.name as keyof typeof MOTION_PRESETS];
      if (presetDef) {
        preset.elapsed += delta;
        let t = preset.elapsed;
        if (preset.loop && presetDef.loopDuration) {
          t = t % presetDef.loopDuration;
        }

        // Interpolate between keyframes
        const kfs = presetDef.keyframes;
        for (let i = 0; i < kfs.length - 1; i++) {
          if (t >= kfs[i].time && t <= kfs[i + 1].time) {
            const span = kfs[i + 1].time - kfs[i].time;
            const alpha = (t - kfs[i].time) / span;
            if (kfs[i].bones || kfs[i + 1].bones) {
              const interp = lerpBones(kfs[i].bones ?? {}, kfs[i + 1].bones ?? {}, alpha);
              applyBones(interp);
            }
            if (kfs[i].blendShapes || kfs[i + 1].blendShapes) {
              const interp = lerpBlendShapes(kfs[i].blendShapes ?? {}, kfs[i + 1].blendShapes ?? {}, alpha);
              applyBlendShapes(interp);
            }
            break;
          }
        }

        // Non-loop preset finished — return to idle
        if (!preset.loop && preset.elapsed > kfs[kfs.length - 1].time + 1.0) {
          presetState.current = { name: 'idle', elapsed: 0, loop: true };
        }
      }
    }

    // Smooth expression transition
    if (state.isAnimating) {
      state.transitionElapsed += delta;
      const rawT = Math.min(state.transitionElapsed / state.transitionDuration, 1);
      const t = easings[state.easing](rawT);

      const interpolated = lerpBlendShapes(state.currentBlendShapes, state.targetBlendShapes, t);
      applyBlendShapes(interpolated);

      if (rawT >= 1) {
        state.currentBlendShapes = { ...state.targetBlendShapes };
        state.isAnimating = false;
      }
    }
  });

  return null;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd character
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/components/ExpressionController.tsx
git commit -m "feat: add ExpressionController with blend shapes, bones, presets"
```

---

## Task 4: Wire ExpressionController into VRMAvatar

**Files:**
- Modify: `character/app/components/VRMAvatar.tsx`

- [ ] **Step 1: Add ExpressionController to VRMScene**

In `VRMAvatar.tsx`, modify `VRMScene` to render `ExpressionController` once the VRM is loaded:

```tsx
// Add import at top:
import { ExpressionController } from './ExpressionController';

// Modify VRMScene to track vrm state:
function VRMScene({ modelPath, onReady, onError }: VRMSceneProps) {
  const vrmRef = useRef<VRM | null>(null);
  const [loadedVRM, setLoadedVRM] = useState<VRM | null>(null);
  const { scene } = useThree();

  useEffect(() => {
    // ... (existing loader code unchanged) ...
    // In the loader.load success callback, after scene.add(vrm.scene):
    setLoadedVRM(vrm);
    vrmRef.current = vrm;
    onReady(vrm);
  }, [modelPath, scene, onReady, onError]);

  useFrame((_, delta) => {
    vrmRef.current?.update(delta);
  });

  return loadedVRM ? <ExpressionController vrm={loadedVRM} /> : null;
}
```

Also add `useState` to imports:
```tsx
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: Start idle preset after model loads**

In `VRMAvatar.tsx`, after `ExpressionController` is rendered, it will automatically start idle from the message in its own `useEffect`. But we need to post the initial `playPreset idle` message after VRM is ready.

In `handleReady` inside `VRMAvatar`, add:
```tsx
const handleReady = (vrm: VRM) => {
  vrmRef.current = vrm;
  isReadyRef.current = true;
  sendToRN('vrmReady', { modelName: modelPath.split('/').pop() });

  // Start idle animation
  setTimeout(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({ type: 'playPreset', data: { name: 'idle', loop: true } })
    }));
  }, 100);

  // Heartbeat
  heartbeatRef.current = setInterval(() => {
    sendToRN('heartbeat', { timestamp: Date.now(), modelLoaded: true });
  }, 5000);
};
```

- [ ] **Step 3: TypeScript check**

```bash
cd character
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/components/VRMAvatar.tsx
git commit -m "feat: wire ExpressionController into VRMAvatar, start idle on ready"
```

---

## Task 5: Update motionMapper in EmoMate

**Files:**
- Modify: `EmoMate/src/capabilities/motion/motionMapper.ts`

- [ ] **Step 1: Add VRM command types to EmoMate**

Create `EmoMate/src/types/vrm.ts`:

```typescript
// EmoMate/src/types/vrm.ts

export interface VRMBlendShapeMap {
  joy?: number;
  angry?: number;
  sorrow?: number;
  fun?: number;
  surprised?: number;
  neutral?: number;
}

export interface VRMBoneRotation {
  x?: number;
  y?: number;
  z?: number;
}

export interface VRMBoneMap {
  head?: VRMBoneRotation;
  neck?: VRMBoneRotation;
  spine?: VRMBoneRotation;
  leftUpperArm?: VRMBoneRotation;
  leftLowerArm?: VRMBoneRotation;
  rightUpperArm?: VRMBoneRotation;
  rightLowerArm?: VRMBoneRotation;
}

export interface VRMCommand {
  type: 'setExpression' | 'playPreset' | 'playPose' | 'stopAll';
  data?: any;
}

export interface VRMMotionResult {
  expressionCommand: VRMCommand;
  presetCommand?: VRMCommand;
}
```

- [ ] **Step 2: Add emotionToVRMCommands function to motionMapper.ts**

At the bottom of `EmoMate/src/capabilities/motion/motionMapper.ts`, add:

```typescript
import { VRMMotionResult } from '../../types/vrm';

/**
 * Maps a Plutchik emotion to VRM bridge commands.
 * Returns an expression command + optional preset command.
 */
export function emotionToVRMCommands(
  emotion: EmotionType,
  intensity: number = 1.0
): VRMMotionResult {
  const scale = Math.max(0.1, Math.min(1.0, intensity));

  const map: Record<EmotionType, VRMMotionResult> = {
    joy: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { joy: 0.8 * scale }, duration: 0.5 },
      },
      presetCommand: { type: 'playPreset', data: { name: 'happy' } },
    },
    sadness: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { sorrow: 0.7 * scale }, duration: 0.8 },
      },
    },
    anger: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { angry: 0.6 * scale }, duration: 0.5 },
      },
    },
    fear: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { surprised: 0.5 * scale, sorrow: 0.3 * scale }, duration: 0.5 },
      },
      presetCommand: { type: 'playPreset', data: { name: 'shy' } },
    },
    surprise: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { surprised: 0.9 * scale }, duration: 0.3 },
      },
      presetCommand: { type: 'playPreset', data: { name: 'surprised' } },
    },
    disgust: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { angry: 0.4 * scale, sorrow: 0.2 * scale }, duration: 0.5 },
      },
    },
    trust: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { joy: 0.4 * scale, fun: 0.3 * scale }, duration: 0.5 },
      },
    },
    anticipation: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { fun: 0.5 * scale }, duration: 0.5 },
      },
      presetCommand: { type: 'playPreset', data: { name: 'thinking' } },
    },
    neutral: {
      expressionCommand: {
        type: 'setExpression',
        data: { blendShapes: { neutral: 0 }, duration: 0.5 },
      },
    },
  };

  return map[emotion] ?? map.neutral;
}
```

- [ ] **Step 3: TypeScript check in EmoMate**

```bash
cd EmoMate
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add EmoMate/src/types/vrm.ts EmoMate/src/capabilities/motion/motionMapper.ts
git commit -m "feat: add emotionToVRMCommands to motionMapper"
```

---

## Task 6: Update HiyoriWebView Bridge

**Files:**
- Modify: `EmoMate/src/components/HiyoriWebView.tsx`

- [ ] **Step 1: Add helper to send VRM commands**

In `HiyoriWebView.tsx`, add a method to send VRM commands via the WebView. Find the WebView ref usage and add:

```typescript
// Add near the top of the component, after webViewRef is declared:
const sendVRMCommand = useCallback((cmd: { type: string; data?: any }) => {
  if (!webViewRef.current) return;
  const message = JSON.stringify(cmd);
  webViewRef.current.postMessage(message);
}, []);

// Expose via ref so parent components can call it:
React.useImperativeHandle(ref, () => ({
  // ... existing methods ...
  sendVRMCommand,
}));
```

- [ ] **Step 2: Export sendVRMCommand in the ref interface**

Find the `HiyoriBridge` interface and add:
```typescript
interface HiyoriBridge {
  playMotion: (motionName: string) => void;
  getAvailableMotions: () => void;
  checkModelStatus: () => void;
  reload: () => void;
  sendVRMCommand: (cmd: { type: string; data?: any }) => void;  // NEW
}
```

- [ ] **Step 3: Commit**

```bash
git add EmoMate/src/components/HiyoriWebView.tsx
git commit -m "feat: add sendVRMCommand to HiyoriWebView bridge"
```

---

## Task 7: Connect Emotion Detection to VRM Commands

**Files:**
- Modify: `EmoMate/src/screens/HomeScreen.tsx` (or wherever `motionMapper` is called)

- [ ] **Step 1: Find where Live2D motions are triggered**

```bash
grep -r "selectMotion\|emotionToMotion\|playMotion" EmoMate/src --include="*.ts" --include="*.tsx" -l
```

- [ ] **Step 2: Replace Live2D motion calls with VRM commands**

In the file that calls `playMotion`, replace:

```typescript
// OLD (Live2D)
const motion = selectMotion(context);
webViewRef.current?.playMotion(motion.motion);

// NEW (VRM) — import emotionToVRMCommands first
import { emotionToVRMCommands } from '../capabilities/motion/motionMapper';

const emotion = context.emotion ?? 'neutral';
const { expressionCommand, presetCommand } = emotionToVRMCommands(emotion, 1.0);
webViewRef.current?.sendVRMCommand(expressionCommand);
if (presetCommand) {
  webViewRef.current?.sendVRMCommand(presetCommand);
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: connect emotion detection to VRM expression commands"
```

---

## Verification Checklist

- [ ] Run `npm run dev` in `character/` — no errors
- [ ] Character breathes gently (idle preset loops)
- [ ] Open DevTools Console, run: `window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'playPreset', data: { name: 'wave' } }) }))` — character waves
- [ ] Run: `window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'setExpression', data: { blendShapes: { joy: 0.9 }, duration: 0.5 } }) }))` — character smiles
- [ ] `npx tsc --noEmit` passes in both `character/` and `EmoMate/`
- [ ] In EmoMate, sending a message that triggers joy emotion causes character to smile + happy preset
- [ ] Auto-blink fires randomly every 0.5–4 seconds
- [ ] After non-looping preset finishes, character returns to idle

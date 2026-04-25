// character/app/components/motionPresets.ts
//
// Axis reference for this VRM model (normalized humanoid, VRM1 / VRoid):
//   rightUpperArm.z: + = lower arm to side,  - = raise arm up
//   leftUpperArm.z:  + = raise arm up,  - = lower arm to side  (symmetric)
//   arm.y:           - = swing arm forward,  + = swing backward
//   head.y:          + = turn right,  - = turn left
//   head.x:          + = nod down,    - = tilt up/back
//   head.z:          + = tilt toward right shoulder
//   spine.z:         small values for gentle sway

import { BoneMap, BlendShapeMap, PresetName } from '../types/vrm-bridge';

export interface Keyframe {
  time: number;
  bones?: BoneMap;
  blendShapes?: BlendShapeMap;
}

export interface MotionPreset {
  name: PresetName;
  keyframes: Keyframe[];
  loop: boolean;
  loopDuration?: number;
}

// Rest pose shared across presets (arms at sides)
const R: BoneMap = { rightUpperArm: { z: 1.5 }, leftUpperArm: { z: -1.5 } };

export const MOTION_PRESETS: Record<PresetName, MotionPreset> = {

  // ── Idle: subtle breathing sway, arms at sides ───────────────────────────
  idle: {
    name: 'idle',
    loop: true,
    loopDuration: 4.0,
    keyframes: [
      { time: 0.0, bones: { rightUpperArm: { z: 1.5 }, leftUpperArm: { z: -1.5 }, spine: { z: 0 },    head: { x: 0, y: 0,     z: 0 } } },
      { time: 1.0, bones: { rightUpperArm: { z: 1.5 }, leftUpperArm: { z: -1.5 }, spine: { z: 0.02 }, head: { x: 0, y: 0.06,  z: 0 } } },
      { time: 2.0, bones: { rightUpperArm: { z: 1.5 }, leftUpperArm: { z: -1.5 }, spine: { z: 0.03 }, head: { x: 0, y: 0,     z: 0 } } },
      { time: 3.0, bones: { rightUpperArm: { z: 1.5 }, leftUpperArm: { z: -1.5 }, spine: { z: 0.02 }, head: { x: 0, y: -0.06, z: 0 } } },
      { time: 4.0, bones: { rightUpperArm: { z: 1.5 }, leftUpperArm: { z: -1.5 }, spine: { z: 0 },    head: { x: 0, y: 0,     z: 0 } } },
    ],
  },

  // ── Speaking: gentle head nods while talking ──────────────────────────────
  speaking: {
    name: 'speaking',
    loop: true,
    loopDuration: 2.0,
    keyframes: [
      { time: 0.0, bones: { ...R, head: { x: 0 },    spine: { z: 0 } } },
      { time: 0.5, bones: { ...R, head: { x: 0.08 }, spine: { z: 0.02 } } },
      { time: 1.0, bones: { ...R, head: { x: 0 },    spine: { z: 0.03 } } },
      { time: 1.5, bones: { ...R, head: { x: 0.06 }, spine: { z: 0.02 } } },
      { time: 2.0, bones: { ...R, head: { x: 0 },    spine: { z: 0 } } },
    ],
  },

  // ── Thinking: head tilted, right arm raised with bent elbow ───────────────
  thinking: {
    name: 'thinking',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { ...R, head: { z: 0, x: 0 }, rightLowerArm: { z: 0 } } },
      { time: 0.8, bones: {
        rightUpperArm: { z: -0.2, y: -0.4 },
        rightLowerArm: { z: -1.0 },
        leftUpperArm:  { z: -1.5 },
        head: { z: 0.18, x: 0.05 },
        spine: { z: 0.02 },
      }},
    ],
  },

  // ── Wave: raise right arm, wave hand, return to rest ─────────────────────
  wave: {
    name: 'wave',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { ...R, rightLowerArm: { z: 0 }, rightHand: { z: 0 } } },
      { time: 0.4, bones: { rightUpperArm: { z: -1.1 }, leftUpperArm: { z: -1.5 }, rightLowerArm: { z: -0.5 } } },
      { time: 0.8, bones: { rightUpperArm: { z: -1.1 }, leftUpperArm: { z: -1.5 }, rightLowerArm: { z: -0.5 }, rightHand: { z: 0.3 } } },
      { time: 1.2, bones: { rightUpperArm: { z: -1.1 }, leftUpperArm: { z: -1.5 }, rightLowerArm: { z: -0.5 }, rightHand: { z: -0.3 } } },
      { time: 1.6, bones: { rightUpperArm: { z: -1.1 }, leftUpperArm: { z: -1.5 }, rightLowerArm: { z: -0.5 }, rightHand: { z: 0.3 } } },
      { time: 2.0, bones: { rightUpperArm: { z: -1.1 }, leftUpperArm: { z: -1.5 }, rightLowerArm: { z: -0.5 }, rightHand: { z: 0 } } },
      { time: 2.6, bones: { ...R, rightLowerArm: { z: 0 }, rightHand: { z: 0 } } },
    ],
  },

  // ── Shy: arms slightly in front, head tilted down ─────────────────────────
  shy: {
    name: 'shy',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { ...R, head: { x: 0, z: 0 } } },
      { time: 0.8, bones: {
        rightUpperArm: { z: 0.8,  y: -0.3 },
        leftUpperArm:  { z: -0.8, y: -0.3 },
        rightLowerArm: { z: 0.4 },
        leftLowerArm:  { z: -0.4 },
        head: { x: 0.15, z: 0.1 },
      }, blendShapes: { joy: 0.3 } },
    ],
  },

  // ── Excited: both arms raised with joy expression ─────────────────────────
  excited: {
    name: 'excited',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { ...R, spine: { z: 0 } } },
      { time: 0.3, bones: {
        rightUpperArm: { z: -1.0 },
        leftUpperArm:  { z: 1.0 },
        spine: { z: 0.08 },
      }, blendShapes: { joy: 0.8 } },
      { time: 0.7, bones: {
        rightUpperArm: { z: -0.7 },
        leftUpperArm:  { z: 0.7 },
        spine: { z: 0.04 },
      }},
      { time: 1.2, bones: {
        rightUpperArm: { z: -1.0 },
        leftUpperArm:  { z: 1.0 },
        spine: { z: 0.08 },
      }},
    ],
  },

  // ── Surprised: lean back, arms slightly out ───────────────────────────────
  surprised: {
    name: 'surprised',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { ...R, head: { x: 0 }, spine: { z: 0 } } },
      { time: 0.3, bones: {
        rightUpperArm: { z: 1.1 },
        leftUpperArm:  { z: -1.1 },
        head: { x: -0.12 },
        spine: { z: -0.04 },
      }, blendShapes: { surprised: 0.9 } },
      { time: 1.5, bones: { ...R, head: { x: 0 }, spine: { z: 0 } }, blendShapes: { surprised: 0 } },
    ],
  },

  // ── Happy: arms at sides with subtle bounce ───────────────────────────────
  happy: {
    name: 'happy',
    loop: false,
    keyframes: [
      { time: 0.0,  bones: { ...R, spine: { z: 0 } },                           blendShapes: { joy: 0 } },
      { time: 0.25, bones: { ...R, spine: { z: 0.05 }, head: { y: 0.05 } },     blendShapes: { joy: 0.8 } },
      { time: 0.5,  bones: { ...R, spine: { z: 0 },    head: { y: -0.05 } } },
      { time: 0.75, bones: { ...R, spine: { z: 0.04 }, head: { y: 0.04 } } },
      { time: 1.0,  bones: { ...R, spine: { z: 0 },    head: { y: 0 } } },
      { time: 1.5,  bones: { ...R },                                             blendShapes: { joy: 0 } },
    ],
  },

  // ── Laugh: forward bouncing with joy ─────────────────────────────────────────
  laugh: {
    name: 'laugh',
    loop: false,
    keyframes: [
      { time: 0.0,  bones: { ...R, spine: { z: 0 },    head: { x: 0 } },   blendShapes: { joy: 0 } },
      { time: 0.3,  bones: { ...R, spine: { z: 0.08 }, head: { x: 0.12 } }, blendShapes: { joy: 0.9 } },
      { time: 0.6,  bones: { ...R, spine: { z: 0.03 }, head: { x: 0.04 } } },
      { time: 0.9,  bones: { ...R, spine: { z: 0.08 }, head: { x: 0.1 } } },
      { time: 1.2,  bones: { ...R, spine: { z: 0.03 }, head: { x: 0.04 } } },
      { time: 1.5,  bones: { ...R, spine: { z: 0.06 }, head: { x: 0.08 } } },
      { time: 2.0,  bones: { ...R, spine: { z: 0 },    head: { x: 0 } },   blendShapes: { joy: 0 } },
    ],
  },

  // ── Sleepy: head drooping forward, slight slump ───────────────────────────
  sleepy: {
    name: 'sleepy',
    loop: false,
    keyframes: [
      { time: 0.0, bones: { ...R, head: { x: 0 } },             blendShapes: { sorrow: 0 } },
      { time: 2.0, bones: {
        rightUpperArm: { z: 1.6 },
        leftUpperArm:  { z: -1.6 },
        head: { x: 0.28 },
        spine: { z: 0.06 },
      }, blendShapes: { sorrow: 0.3 } },
    ],
  },
};

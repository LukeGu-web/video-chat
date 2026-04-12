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

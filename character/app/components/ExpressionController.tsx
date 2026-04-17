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
            if ((kfs[i].blendShapes || kfs[i + 1].blendShapes) && !state.isAnimating) {
              // Only apply preset blendShapes when no smooth transition is active
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

    // Propagate normalized bone changes to raw bones (must run after applyBones)
    vrm.update(delta);
  });

  return null;
}

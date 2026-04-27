// character/app/components/ExpressionController.tsx

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { VRMBridgeCommand, BlendShapeMap, BoneMap, EasingType } from '../types/vrm-bridge';
import { MOTION_PRESETS, Keyframe } from './motionPresets';
import { VRMAPlayer } from './VRMAPlayer';
import { VRMA_MANIFEST, VRMAMotionName } from './vrmaManifest';

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

const BONE_SAFE_RANGES: Record<string, Partial<Record<'x' | 'y' | 'z', [number, number]>>> = {
  head:          { x: [-0.35, 0.35], y: [-0.45, 0.45], z: [-0.35, 0.35] },
  neck:          { x: [-0.25, 0.25], y: [-0.35, 0.35], z: [-0.25, 0.25] },
  spine:         { x: [-0.25, 0.25], z: [-0.15, 0.15] },
  rightUpperArm: { x: [-1.6, 0.3],  z: [-0.3, 1.6] },
  rightLowerArm: { x: [0, 1.6] },
  leftUpperArm:  { x: [-1.6, 0.3],  z: [-1.6, 0.3] },
  leftLowerArm:  { x: [0, 1.6] },
};

function clampBone(
  boneName: string,
  rot: { x?: number; y?: number; z?: number }
): { x?: number; y?: number; z?: number } {
  const ranges = BONE_SAFE_RANGES[boneName];
  if (!ranges) return rot;
  const result: { x?: number; y?: number; z?: number } = {};
  for (const axis of ['x', 'y', 'z'] as const) {
    if (rot[axis] === undefined) continue;
    const range = ranges[axis];
    result[axis] = range
      ? Math.max(range[0], Math.min(range[1], rot[axis]!))
      : rot[axis];
  }
  return result;
}

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
  holdDuration: number;
  holdElapsed: number;
  isHolding: boolean;
}

interface PresetState {
  name: string | null;
  elapsed: number;
  loop: boolean;
}

// ─── Priority constants (module-level, never changes) ─────────────────────────

const CMD_PRIORITY = { setExpression: 0, playPose: 1, playPreset: 2 } as const;

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
    holdDuration: 0,
    holdElapsed: 0,
    isHolding: false,
  });

  const presetState = useRef<PresetState>({ name: 'idle', elapsed: 0, loop: true });

  // Blink state machine — replaces setTimeout approach to avoid race conditions
  // with the smooth-transition system and LipSyncController.
  const blinkTimer = useRef(0);
  const nextBlinkTime = useRef(2.0);
  const blinkPhase = useRef<'idle' | 'closing' | 'opening'>('idle');
  const blinkPhaseTimer = useRef(0);
  const BLINK_CLOSE_DURATION = 0.06;
  const BLINK_OPEN_DURATION  = 0.08;

  // Tracks whether the preset is currently driving non-trivial blendShapes so
  // hasActiveExpression stays true and blink is suppressed.
  const presetBlendShapeActive = useRef(false);

  const idleReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vrmaPlayer = useRef<VRMAPlayer | null>(null);
  const vrmaClips = useRef<Map<string, THREE.AnimationClip>>(new Map());
  const currentPriority = useRef(0);

  // ─── setValue helpers (no em.update — called once at end of frame) ──────────

  const setBlendShapeValues = (shapes: BlendShapeMap) => {
    const em = vrm.expressionManager;
    if (!em) return;
    for (const [key, value] of Object.entries(shapes)) {
      const vrmName = VRM_EXPRESSION_MAP[key];
      if (vrmName && value !== undefined) {
        em.setValue(vrmName, Math.max(0, Math.min(1, value)));
      }
    }
  };

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

  // ─── Interpolation helpers ─────────────────────────────────────────────────

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
          state.holdDuration = cmd.data.holdDuration ?? 0;
          state.holdElapsed = 0;
          state.isHolding = false;
          break;

        case 'playPose': {
          if (cmd.data.blendShapes) {
            state.targetBlendShapes = cmd.data.blendShapes;
          }
          if (cmd.data.bones) {
            const safeBones: Record<string, { x?: number; y?: number; z?: number }> = {};
            for (const [boneName, rot] of Object.entries(
              cmd.data.bones as Record<string, { x?: number; y?: number; z?: number }>
            )) {
              if (rot) safeBones[boneName] = clampBone(boneName, rot);
            }
            state.targetBones = safeBones as typeof state.targetBones;
          }
          const poseDuration = cmd.data.duration ?? 1.0;
          state.transitionDuration = poseDuration;
          state.transitionElapsed = 0;
          state.easing = cmd.data.easing ?? 'easeInOut';
          state.isAnimating = true;
          presetState.current = { name: null, elapsed: 0, loop: false };
          if (idleReturnTimer.current) clearTimeout(idleReturnTimer.current);
          idleReturnTimer.current = setTimeout(() => {
            presetState.current = { name: 'idle', elapsed: 0, loop: true };
            state.currentBones = {};
            state.targetBones = {};
            const activeShapes = Object.fromEntries(
              Object.entries(state.currentBlendShapes)
                .filter(([, v]) => (v ?? 0) > 0.01)
                .map(([k]) => [k, 0])
            ) as BlendShapeMap;
            if (Object.keys(activeShapes).length > 0) {
              state.targetBlendShapes = activeShapes;
              state.transitionDuration = 0.5;
              state.transitionElapsed = 0;
              state.easing = 'easeInOut';
              state.isAnimating = true;
            }
            idleReturnTimer.current = null;
          }, (poseDuration + 0.8) * 1000);
          break;
        }

        case 'playPreset': {
          if (CMD_PRIORITY.playPreset < currentPriority.current) break; // blocked by higher priority
          const newPresetDef = MOTION_PRESETS[cmd.data.name];
          if (newPresetDef) {
            const current = presetState.current;
            const lastKfTime = newPresetDef.keyframes[newPresetDef.keyframes.length - 1].time;
            // Don't restart a non-loop preset that is already in progress — rapid
            // camera emotion re-triggers would otherwise keep resetting elapsed to 0,
            // preventing the arm from ever completing the return to rest.
            const alreadyPlaying =
              !newPresetDef.loop &&
              current.name === cmd.data.name &&
              current.elapsed <= lastKfTime + 1.0;

            if (!alreadyPlaying) {
              presetState.current = {
                name: cmd.data.name,
                elapsed: 0,
                loop: cmd.data.loop ?? newPresetDef.loop,
              };
              currentPriority.current = CMD_PRIORITY.playPreset;
            }
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

        case 'playVRMA': {
          const motionData = cmd.data as { name: VRMAMotionName };
          const clip = vrmaClips.current.get(motionData.name);
          if (!clip || !vrmaPlayer.current) break;
          presetState.current = { name: null, elapsed: 0, loop: false };
          vrmaPlayer.current.play(clip, () => {
            presetState.current = { name: 'idle', elapsed: 0, loop: true };
          });
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (idleReturnTimer.current) clearTimeout(idleReturnTimer.current);
    };
  }, []);

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

  // ─── Per-frame update ──────────────────────────────────────────────────────

  useFrame((_, delta) => {
    const state = animState.current;
    const preset = presetState.current;
    const em = vrm.expressionManager;

    // ── Expression activity check (used to gate blink) ────────────────────
    const hasActiveExpression =
      state.isHolding ||
      state.isAnimating ||
      presetBlendShapeActive.current ||
      Object.values(state.currentBlendShapes).some(v => (v ?? 0) > 0.05);

    // ── Frame-based blink state machine ───────────────────────────────────
    // Abort in-progress blink the moment an expression becomes active so that
    // closing/opening frames don't fight with an expression transition.
    if (hasActiveExpression && blinkPhase.current !== 'idle') {
      blinkPhase.current = 'idle';
      blinkPhaseTimer.current = 0;
      setBlendShapeValues({ blink: 0 });
    }

    blinkTimer.current += delta;
    if (blinkTimer.current >= nextBlinkTime.current) {
      blinkTimer.current = 0;
      nextBlinkTime.current = 0.5 + Math.random() * 3.5;
      if (!hasActiveExpression && blinkPhase.current === 'idle') {
        blinkPhase.current = 'closing';
        blinkPhaseTimer.current = 0;
      }
    }

    if (blinkPhase.current === 'closing') {
      blinkPhaseTimer.current += delta;
      const t = Math.min(blinkPhaseTimer.current / BLINK_CLOSE_DURATION, 1);
      setBlendShapeValues({ blink: t });
      if (t >= 1) {
        blinkPhase.current = 'opening';
        blinkPhaseTimer.current = 0;
      }
    } else if (blinkPhase.current === 'opening') {
      blinkPhaseTimer.current += delta;
      const t = Math.min(blinkPhaseTimer.current / BLINK_OPEN_DURATION, 1);
      setBlendShapeValues({ blink: 1 - t });
      if (t >= 1) {
        blinkPhase.current = 'idle';
        blinkPhaseTimer.current = 0;
      }
    }

    // ── Preset animation ──────────────────────────────────────────────────
    // Reset preset blendShape tracking; will be set true below if active.
    presetBlendShapeActive.current = false;

    // All presets always run so non-loop presets can complete and return bones
    // to rest. For the looping idle preset we only suppress head/spine bones
    // while a setExpression hold is active to prevent the face from wobbling;
    // the arm bones (constant at rest in idle) are still applied so they can
    // cleanly reset after any non-loop preset finishes.
    if (preset.name) {
      const presetDef = MOTION_PRESETS[preset.name as keyof typeof MOTION_PRESETS];
      if (presetDef) {
        preset.elapsed += delta;
        let t = preset.elapsed;
        if (preset.loop && presetDef.loopDuration) {
          t = t % presetDef.loopDuration;
        }

        const kfs = presetDef.keyframes;
        for (let i = 0; i < kfs.length - 1; i++) {
          if (t >= kfs[i].time && t <= kfs[i + 1].time) {
            const span = kfs[i + 1].time - kfs[i].time;
            const alpha = (t - kfs[i].time) / span;
            if (kfs[i].bones || kfs[i + 1].bones) {
              const interp = lerpBones(kfs[i].bones ?? {}, kfs[i + 1].bones ?? {}, alpha);
              if (state.isHolding && preset.name === 'idle') {
                // Skip head/spine sway from idle during a held expression.
                const withoutHead: BoneMap = { ...interp };
                delete withoutHead.head;
                delete withoutHead.neck;
                delete withoutHead.spine;
                applyBones(withoutHead);
              } else {
                applyBones(interp);
              }
            }
            if ((kfs[i].blendShapes || kfs[i + 1].blendShapes) && !state.isAnimating) {
              const interp = lerpBlendShapes(kfs[i].blendShapes ?? {}, kfs[i + 1].blendShapes ?? {}, alpha);
              setBlendShapeValues(interp);
              presetBlendShapeActive.current = Object.values(interp).some(v => (v ?? 0) > 0.05);
            }
            break;
          }
        }

        // Non-loop preset finished — fade out any blendShapes it set, then
        // return to idle.  Without the fade-out the last expression value
        // (e.g. joy: 0.3 from shy) would persist indefinitely.
        if (!preset.loop && preset.elapsed > kfs[kfs.length - 1].time + 1.0) {
          const lastKf = kfs[kfs.length - 1];
          if (lastKf.blendShapes && Object.keys(lastKf.blendShapes).length > 0) {
            state.currentBlendShapes = { ...lastKf.blendShapes };
            state.targetBlendShapes = Object.fromEntries(
              Object.keys(lastKf.blendShapes).map(k => [k, 0])
            ) as BlendShapeMap;
            state.transitionDuration = 0.5;
            state.transitionElapsed = 0;
            state.easing = 'easeOut';
            state.isAnimating = true;
          }
          presetState.current = { name: 'idle', elapsed: 0, loop: true };
          currentPriority.current = 0; // preset finished — accept new commands
        }
      }
    }

    // ── Smooth expression transition ──────────────────────────────────────
    if (state.isAnimating) {
      state.transitionElapsed += delta;
      const rawT = Math.min(state.transitionElapsed / state.transitionDuration, 1);
      const t = easings[state.easing](rawT);

      const interpolated = lerpBlendShapes(state.currentBlendShapes, state.targetBlendShapes, t);
      setBlendShapeValues(interpolated);

      if (Object.keys(state.targetBones).length > 0) {
        const interpolatedBones = lerpBones(state.currentBones, state.targetBones, t);
        applyBones(interpolatedBones);
      }

      if (rawT >= 1) {
        state.currentBlendShapes = { ...state.targetBlendShapes };
        state.currentBones = { ...state.targetBones };
        state.isAnimating = false;
        if (state.holdDuration > 0) {
          state.isHolding = true;
          state.holdElapsed = 0;
        }
      }
    }

    // ── Hold phase ────────────────────────────────────────────────────────
    if (state.isHolding) {
      state.holdElapsed += delta;
      if (state.holdElapsed >= state.holdDuration) {
        state.isHolding = false;
        state.holdDuration = 0;
        state.targetBlendShapes = Object.fromEntries(
          Object.keys(state.currentBlendShapes).map(k => [k, 0])
        ) as BlendShapeMap;
        state.transitionDuration = 0.5;
        state.transitionElapsed = 0;
        state.easing = 'easeInOut';
        state.isAnimating = true;
      }
    }

    // ── Single em.update() + vrm.update() at end of frame ─────────────────
    // All em.setValue calls (including those from LipSyncController which runs
    // before this component in the render tree) are compiled here in one shot.
    if (em) em.update();
    vrmaPlayer.current?.update(delta);
    vrm.update(delta);
  });

  return null;
}

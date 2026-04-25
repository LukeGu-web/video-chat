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

export interface VisemeFrame {
  shape: 'aa' | 'ee' | 'ih' | 'oh' | 'ou' | 'sil';
  time: number;   // seconds from playback start
  weight: number; // 0–1 intensity
}

// Commands sent from EmoMate → WebView
export type VRMBridgeCommand =
  | { type: 'playPreset'; data: { name: PresetName; loop?: boolean } }
  | { type: 'setExpression'; data: { blendShapes: BlendShapeMap; duration?: number; holdDuration?: number } }
  | { type: 'playPose'; data: { blendShapes?: BlendShapeMap; bones?: BoneMap; duration?: number; easing?: EasingType } }
  | { type: 'prepareVisemes'; data: { visemes: VisemeFrame[]; totalDuration: number } }
  | { type: 'playVisemes'; data: { visemes: VisemeFrame[]; totalDuration: number } }
  | { type: 'stopVisemes' }
  | { type: 'stopAll' }
  | { type: 'ping' }
  | { type: 'playVRMA'; data: { url: string; loop?: boolean } };

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

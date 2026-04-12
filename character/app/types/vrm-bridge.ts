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

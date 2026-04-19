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

export interface VisemeFrame {
  shape: 'aa' | 'ee' | 'ih' | 'oh' | 'ou' | 'sil';
  time: number;
  weight: number;
}

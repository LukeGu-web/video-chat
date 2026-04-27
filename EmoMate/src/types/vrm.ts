// EmoMate/src/types/vrm.ts

export type VRMAMotionName =
  | 'full_pose'
  | 'greeting'
  | 'v_sign'
  | 'photo_pose'
  | 'spin'
  | 'model_pose'
  | 'crouch';

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
  type: 'setExpression' | 'playPreset' | 'playPose' | 'playVRMA' | 'stopAll' | 'prepareVisemes' | 'stopVisemes' | 'lipSyncStart';
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

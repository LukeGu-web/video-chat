export type VRMAMotionName =
  | 'full_pose'
  | 'greeting'
  | 'v_sign'
  | 'photo_pose'
  | 'spin'
  | 'model_pose'
  | 'crouch';

// VRoid official free VRMA pack (7 clips)
export const VRMA_MANIFEST: Record<VRMAMotionName, string> = {
  full_pose:  '/assets/vrma/VRMA_01.vrma',
  greeting:   '/assets/vrma/VRMA_02.vrma',
  v_sign:     '/assets/vrma/VRMA_03.vrma',
  photo_pose: '/assets/vrma/VRMA_04.vrma',
  spin:       '/assets/vrma/VRMA_05.vrma',
  model_pose: '/assets/vrma/VRMA_06.vrma',
  crouch:     '/assets/vrma/VRMA_07.vrma',
};

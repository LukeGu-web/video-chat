type VRMCommandFn = (cmd: { type: string; data?: any }) => void;

let handler: VRMCommandFn | null = null;

export const lipSyncBridge = {
  register(fn: VRMCommandFn) {
    handler = fn;
  },
  sendVRMCommand(cmd: { type: string; data?: any }) {
    handler?.(cmd);
  },
};

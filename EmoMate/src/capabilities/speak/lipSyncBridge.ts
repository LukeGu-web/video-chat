import { VRMCommand } from '../../types/vrm';

type VRMCommandFn = (cmd: VRMCommand) => void;

let handler: VRMCommandFn | null = null;

export const lipSyncBridge = {
  register(fn: VRMCommandFn) {
    handler = fn;
  },
  unregister() {
    handler = null;
  },
  sendVRMCommand(cmd: VRMCommand) {
    handler?.(cmd);
  },
};

import { VRM } from '@pixiv/three-vrm';
import {
  VRMAnimationLoaderPlugin,
  VRMAnimation,
  createVRMAnimationClip,
} from '@pixiv/three-vrm-animation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class VRMAPlayer {
  private mixer: THREE.AnimationMixer;
  private action: THREE.AnimationAction | null = null;
  private finishHandler: (() => void) | null = null;

  constructor(private vrm: VRM) {
    this.mixer = new THREE.AnimationMixer(vrm.scene);
  }

  async load(url: string): Promise<THREE.AnimationClip> {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMAnimationLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    const anims = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;
    if (!anims || anims.length === 0) {
      throw new Error(`No VRM animations found in "${url}"`);
    }
    // Cast needed: three-vrm-animation bundles its own three-vrm-core, causing
    // private-property structural mismatch between the two VRMCore declarations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createVRMAnimationClip(anims[0], this.vrm as any);
  }

  play(clip: THREE.AnimationClip, onFinish: () => void): void {
    this.stop();
    const handler = () => {
      this.mixer.removeEventListener('finished', handler);
      this.finishHandler = null;
      // Release the clamped pose so preset bones can take over immediately.
      this.mixer.stopAllAction();
      this.action = null;
      onFinish();
    };
    this.finishHandler = handler;
    this.mixer.addEventListener('finished', handler);
    this.action = this.mixer.clipAction(clip);
    this.action.setLoop(THREE.LoopOnce, 1);
    this.action.clampWhenFinished = true;
    this.action.play();
  }

  stop(): void {
    if (this.finishHandler) {
      this.mixer.removeEventListener('finished', this.finishHandler);
      this.finishHandler = null;
    }
    this.mixer.stopAllAction();
    this.action = null;
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }

  dispose(): void {
    this.stop();
    this.mixer.uncacheRoot(this.vrm.scene);
  }
}

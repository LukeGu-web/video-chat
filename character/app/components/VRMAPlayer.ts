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

  constructor(private vrm: VRM) {
    this.mixer = new THREE.AnimationMixer(vrm.scene);
  }

  async load(url: string): Promise<THREE.AnimationClip> {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMAnimationLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    const anim: VRMAnimation = gltf.userData.vrmAnimations[0];
    // Cast needed: three-vrm-animation bundles its own three-vrm-core, causing
    // private-property structural mismatch between the two VRMCore declarations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createVRMAnimationClip(anim, this.vrm as any);
  }

  play(clip: THREE.AnimationClip, onFinish: () => void): void {
    this.stop();
    const handler = () => {
      this.mixer.removeEventListener('finished', handler);
      onFinish();
    };
    this.mixer.addEventListener('finished', handler);
    this.action = this.mixer.clipAction(clip);
    this.action.setLoop(THREE.LoopOnce, 1);
    this.action.clampWhenFinished = true;
    this.action.play();
  }

  stop(): void {
    this.mixer.stopAllAction();
    this.action = null;
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }
}

import { useEffect, useRef, forwardRef, useImperativeHandle, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { VRMLoaderPlugin, VRM, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ─── Bridge message types ────────────────────────────────────────────────────

interface BridgeMessage {
  id: string;
  type: string;
  timestamp: number;
  data?: any;
  error?: string;
}

const sendToRN = (type: string, data?: any) => {
  if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
    const msg: BridgeMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      timestamp: Date.now(),
      data,
    };
    (window as any).ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
};

// ─── VRM Scene (inside Canvas) ───────────────────────────────────────────────

interface VRMSceneProps {
  modelPath: string;
  onReady: (vrm: VRM) => void;
  onError: (err: string) => void;
}

function VRMScene({ modelPath, onReady, onError }: VRMSceneProps) {
  const vrmRef = useRef<VRM | null>(null);
  const { scene } = useThree();

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      modelPath,
      (gltf) => {
        const vrm: VRM = (gltf as any).userData.vrm;
        if (!vrm) {
          onError('VRM data not found in GLTF');
          return;
        }

        // Rotate model to face camera (VRM models face +Z by default)
        VRMUtils.rotateVRM0(vrm);

        // Remove unnecessary vertices/joints for performance
        VRMUtils.removeUnnecessaryVertices(vrm.scene);
        VRMUtils.removeUnnecessaryJoints(vrm.scene);

        // Scale and position: model origin is at feet, shift up to center upper body
        vrm.scene.scale.setScalar(1.0);
        vrm.scene.position.set(0, 0, 0);

        scene.add(vrm.scene);
        vrmRef.current = vrm;
        onReady(vrm);
      },
      undefined,
      (err) => {
        onError(err instanceof Error ? err.message : 'Failed to load VRM');
      }
    );

    return () => {
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        vrmRef.current = null;
      }
    };
  }, [modelPath, scene, onReady, onError]);

  useFrame((_, delta) => {
    vrmRef.current?.update(delta);
  });

  return null;
}

// ─── Camera Setup ─────────────────────────────────────────────────────────────

function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    // Position camera to show upper body (head + torso)
    camera.position.set(0, 1.2, 2.0);
    camera.lookAt(0, 1.2, 0);
  }, [camera]);
  return null;
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface VRMAvatarRef {
  getVRM: () => VRM | null;
  isReady: () => boolean;
}

interface VRMAvatarProps {
  modelPath: string;
  width?: number;
  height?: number;
  className?: string;
}

const VRMAvatar = forwardRef<VRMAvatarRef, VRMAvatarProps>(
  ({ modelPath, width = 500, height = 700, className = '' }, ref) => {
    const vrmRef = useRef<VRM | null>(null);
    const isReadyRef = useRef(false);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useImperativeHandle(ref, () => ({
      getVRM: () => vrmRef.current,
      isReady: () => isReadyRef.current,
    }));

    const handleReady = (vrm: VRM) => {
      vrmRef.current = vrm;
      isReadyRef.current = true;
      sendToRN('vrmReady', { modelName: modelPath.split('/').pop() });

      // Heartbeat every 5s (matches existing bridge protocol)
      heartbeatRef.current = setInterval(() => {
        sendToRN('heartbeat', { timestamp: Date.now(), modelLoaded: true });
      }, 5000);
    };

    const handleError = (err: string) => {
      sendToRN('initError', { error: err });
    };

    useEffect(() => {
      return () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        sendToRN('cleanup', { timestamp: Date.now() });
      };
    }, []);

    return (
      <div className={className} style={{ width, height }}>
        <Canvas
          style={{ width: '100%', height: '100%', background: 'transparent' }}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 30, near: 0.1, far: 100 }}
          onCreated={({ gl }) => {
            // Ensure fully transparent background for WebView integration
            gl.setClearColor(0x000000, 0);
          }}
        >
          <CameraSetup />
          <ambientLight intensity={0.8} />
          <directionalLight position={[1, 2, 3]} intensity={1.2} />
          <Suspense fallback={null}>
            <VRMScene
              modelPath={modelPath}
              onReady={handleReady}
              onError={handleError}
            />
          </Suspense>
        </Canvas>
      </div>
    );
  }
);

VRMAvatar.displayName = 'VRMAvatar';
export default VRMAvatar;

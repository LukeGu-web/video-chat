# VRM Phase 1 — Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PIXI.js + Live2D in `character/` with Three.js + React Three Fiber + @pixiv/three-vrm, rendering the Girl C VRM model in the WebView.

**Architecture:** Keep the Remix app structure unchanged. Replace only the rendering component (`HiyoriLive2D.tsx` → `VRMAvatar.tsx`). Use React Three Fiber's `<Canvas>` with `@pixiv/three-vrm` via a GLTFLoader plugin. Maintain the existing WebView bridge protocol, sending `vrmReady` when the model loads.

**Tech Stack:** `three`, `@react-three/fiber`, `@react-three/drei`, `@pixiv/three-vrm`, Remix, TypeScript

---

## Pre-requisite: Download VRM Model

Before starting any code task:

- [ ] Go to <https://hub.vroid.com/en/characters/7443348617497937928/models/6730821026004308050>
- [ ] Log in with pixiv account → click "Use this model" → Download `.vrm` file
- [ ] Place the file at: `character/public/assets/vrm/girl_c.vrm`
- [ ] Verify the file exists: `ls character/public/assets/vrm/girl_c.vrm`

---

## Task 1: Update Dependencies

**Files:**

- Modify: `character/package.json`

- [ ] **Step 1: Remove old dependencies, add new ones**

```bash
cd character
npm uninstall pixi.js pixi-live2d-display-mulmotion
npm install three @react-three/fiber @react-three/drei @pixiv/three-vrm
npm install --save-dev @types/three
```

- [ ] **Step 2: Verify install succeeded**

```bash
cat package.json | grep -E "three|react-three|pixiv"
```

Expected output includes:

```
"three": "...",
"@react-three/fiber": "...",
"@react-three/drei": "...",
"@pixiv/three-vrm": "..."
```

- [ ] **Step 3: Commit**

```bash
cd character
git add package.json package-lock.json
git commit -m "chore: replace pixi/live2d deps with three-vrm stack"
```

---

## Task 2: Remove Live2D Scripts from root.tsx

**Files:**

- Modify: `character/app/root.tsx`

- [ ] **Step 1: Remove the two Live2D script tags**

Open `character/app/root.tsx`. Remove these two lines from the `<head>`:

```tsx
// DELETE these two lines:
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
```

The `<head>` section should look like this after the edit:

```tsx
<head>
  <meta charSet="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <Meta />
  <Links />
</head>
```

- [ ] **Step 2: Commit**

```bash
cd character
git add app/root.tsx
git commit -m "chore: remove Live2D CDN scripts from root"
```

---

## Task 3: Create VRMAvatar Component

**Files:**

- Create: `character/app/components/VRMAvatar.tsx`
- Delete: `character/app/components/HiyoriLive2D.tsx` (after Task 4)

- [ ] **Step 1: Create the file**

Create `character/app/components/VRMAvatar.tsx` with the full content:

```tsx
import { useEffect, useRef, forwardRef, useImperativeHandle, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
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
  const { scene, camera } = useThree();

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

        // Remove back-face culling for proper rendering
        VRMUtils.removeUnnecessaryVertices(vrm.scene);
        VRMUtils.removeUnnecessaryJoints(vrm.scene);

        // Scale and position for upper-body view
        vrm.scene.scale.setScalar(1.0);
        vrm.scene.position.set(0, -1.0, 0);

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
    camera.position.set(0, 0.5, 2.5);
    camera.lookAt(0, 0.5, 0);
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
    const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

    useImperativeHandle(ref, () => ({
      getVRM: () => vrmRef.current,
      isReady: () => isReadyRef.current,
    }));

    const handleReady = (vrm: VRM) => {
      vrmRef.current = vrm;
      isReadyRef.current = true;
      sendToRN('vrmReady', { modelName: modelPath.split('/').pop() });

      // Heartbeat every 5s (matches existing protocol)
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd character
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated errors)

- [ ] **Step 3: Commit**

```bash
git add app/components/VRMAvatar.tsx
git commit -m "feat: add VRMAvatar component with three-vrm rendering"
```

---

## Task 4: Update Route to Use VRMAvatar

**Files:**

- Modify: `character/app/routes/_index.tsx`

- [ ] **Step 1: Replace HiyoriLive2D with VRMAvatar**

Replace the entire content of `character/app/routes/_index.tsx`:

```tsx
import type { MetaFunction } from '@remix-run/node';
import { ClientOnly } from 'remix-utils/client-only';
import { useRef } from 'react';
import VRMAvatar, { type VRMAvatarRef } from '~/components/VRMAvatar';

export const meta: MetaFunction = () => {
  return [
    { title: 'Character App' },
    { name: 'description', content: 'VRM Character Display' },
  ];
};

export default function Index() {
  const avatarRef = useRef<VRMAvatarRef>(null);

  return (
    <div className='flex h-screen items-center justify-center'
         style={{ background: 'transparent' }}>
      <ClientOnly
        fallback={
          <div className='w-96 h-96 flex items-center justify-center text-gray-400'>
            Loading...
          </div>
        }
      >
        {() => (
          <VRMAvatar
            ref={avatarRef}
            modelPath='/assets/vrm/girl_c.vrm'
            width={500}
            height={700}
          />
        )}
      </ClientOnly>
    </div>
  );
}
```

- [ ] **Step 2: Delete old Live2D component**

```bash
cd character
rm app/components/HiyoriLive2D.tsx
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add app/routes/_index.tsx
git add -u app/components/HiyoriLive2D.tsx
git commit -m "feat: replace HiyoriLive2D with VRMAvatar in route"
```

---

## Task 5: Verify in Browser

- [ ] **Step 1: Start the dev server**

```bash
cd character
npm run dev
```

Expected output:

```
  ➜  Local:   http://localhost:5174/
  ➜  Network: http://192.168.x.x:5174/
```

- [ ] **Step 2: Open browser and check**

Open `http://localhost:5174/` in Chrome. Verify:

- Girl C character is visible
- Background is transparent (checkerboard in browser dev, transparent in WebView)
- No red error screen
- Open DevTools Console — no WebGL errors

- [ ] **Step 3: Check bridge message**

In Chrome DevTools Console, run:

```javascript
// Simulate what React Native does — check that vrmReady fires
window.ReactNativeWebView = { postMessage: (m) => console.log('Bridge:', JSON.parse(m)) };
location.reload();
```

After reload, you should see in the console:

```
Bridge: { id: "msg_...", type: "vrmReady", data: { modelName: "girl_c.vrm" }, ... }
```

- [ ] **Step 4: Check Spring Bone physics (bonus)**

In the browser, try tilting your screen or scrolling — if the model's hair moves naturally, Spring Bone physics are working automatically via three-vrm.

---

## Task 6: Update EmoMate Bridge Handler

**Files:**

- Modify: `EmoMate/src/components/HiyoriWebView.tsx`

The existing bridge handler in `HiyoriWebView.tsx` handles `modelReady` messages. We need to also accept `vrmReady` so EmoMate knows the new model is loaded.

- [ ] **Step 1: Find the message handler**

In `EmoMate/src/components/HiyoriWebView.tsx`, find the `onMessage` handler (around line 60-100). It has a switch/if-else on `message.type`.

- [ ] **Step 2: Add vrmReady handler**

Find the block that handles `modelReady` and add `vrmReady` alongside it:

```typescript
// Find this pattern:
case 'modelReady':
  // ... existing handler

// Add after or modify to also handle vrmReady:
case 'vrmReady':
case 'modelReady':
  setState(prev => ({ ...prev, isModelReady: true, isLoading: false }));
  onModelReady?.();
  debugLog('HiyoriWebView', 'Model ready (VRM or Live2D)');
  break;
```

- [ ] **Step 3: Commit**

```bash
cd /path/to/video-chat
git add EmoMate/src/components/HiyoriWebView.tsx
git commit -m "feat: handle vrmReady message in HiyoriWebView bridge"
```

---

## Verification Checklist

Run through these before marking Phase 1 complete:

- [ ] `npm run dev` starts without errors
- [ ] Girl C character visible at `http://localhost:5174/`
- [ ] Transparent background (no white/black fill)
- [ ] Character centered, upper body visible, proportions normal
- [ ] DevTools Console shows no WebGL errors
- [ ] Bridge simulation shows `vrmReady` message fires
- [ ] EmoMate WebView loads character (test on device or simulator)
- [ ] `npx tsc --noEmit` passes in `character/`

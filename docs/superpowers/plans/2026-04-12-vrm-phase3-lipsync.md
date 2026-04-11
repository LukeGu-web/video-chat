# VRM Phase 3 — Lip Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the character's mouth move in sync with audio. Route TTS audio from EmoMate's TTSQueue through the WebView bridge as base64, play it in the browser, and feed it to wawa-lipsync which drives VRM mouth blend shapes in real time.

**Architecture:** TTSQueue reads each synthesized audio file, base64-encodes it, and posts a `playAudio` bridge message instead of calling expo-av. The WebView's new `AudioPlayer` component decodes the base64, plays it via a Web Audio API node, and wawa-lipsync taps the audio node to emit real-time viseme data. `LipSyncController` maps visemes to VRM blend shapes (aa/ee/ih/oh/ou) every frame via `useFrame`. When audio ends, WebView posts `audioComplete` back so TTSQueue can advance the queue.

**Tech Stack:** `wawa-lipsync`, Web Audio API, `expo-file-system`, React Three Fiber `useFrame`, `@pixiv/three-vrm` expression manager

---

## Task 1: Install wawa-lipsync

**Files:**
- Modify: `character/package.json`

- [ ] **Step 1: Install the package**

```bash
cd character
npm install wawa-lipsync
```

- [ ] **Step 2: Verify**

```bash
cat package.json | grep wawa
```

Expected: `"wawa-lipsync": "..."`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add wawa-lipsync dependency"
```

---

## Task 2: Create AudioPlayer Component

**Files:**
- Create: `character/app/components/AudioPlayer.tsx`

- [ ] **Step 1: Create the file**

```tsx
// character/app/components/AudioPlayer.tsx

import { useEffect, useRef, useCallback } from 'react';

interface BridgeMessage {
  type: string;
  data?: any;
}

const sendToRN = (type: string, data?: any) => {
  if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
    (window as any).ReactNativeWebView.postMessage(
      JSON.stringify({ id: `msg_${Date.now()}`, type, timestamp: Date.now(), data })
    );
  }
};

interface AudioPlayerProps {
  onSourceNodeReady: (node: AudioBufferSourceNode, context: AudioContext) => void;
  onPlaybackEnd: () => void;
}

export function AudioPlayer({ onSourceNodeReady, onPlaybackEnd }: AudioPlayerProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      let msg: BridgeMessage;
      try {
        msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (msg.type === 'playAudio' && msg.data?.audioBase64) {
        // Stop any currently playing audio
        if (currentSourceRef.current) {
          try { currentSourceRef.current.stop(); } catch {}
          currentSourceRef.current = null;
        }

        const { audioBase64, mimeType = 'audio/mpeg', id } = msg.data;

        try {
          // Decode base64 → ArrayBuffer
          const binaryStr = atob(audioBase64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const arrayBuffer = bytes.buffer;

          // Decode audio data
          const ctx = getAudioContext();
          // Resume context if suspended (browser autoplay policy)
          if (ctx.state === 'suspended') await ctx.resume();

          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);

          // Notify LipSyncController
          onSourceNodeReady(source, ctx);

          source.onended = () => {
            currentSourceRef.current = null;
            onPlaybackEnd();
            sendToRN('audioComplete', { id });
          };

          source.start(0);
          currentSourceRef.current = source;
          sendToRN('lipSyncStart');
        } catch (err) {
          console.error('[AudioPlayer] Failed to play audio:', err);
          sendToRN('audioComplete', { id: msg.data?.id, error: String(err) });
        }
      }

      if (msg.type === 'stopAudio') {
        if (currentSourceRef.current) {
          try { currentSourceRef.current.stop(); } catch {}
          currentSourceRef.current = null;
        }
        sendToRN('lipSyncEnd');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [getAudioContext, onSourceNodeReady, onPlaybackEnd]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/AudioPlayer.tsx
git commit -m "feat: add AudioPlayer component for WebView audio playback"
```

---

## Task 3: Create LipSyncController Component

**Files:**
- Create: `character/app/components/LipSyncController.tsx`

- [ ] **Step 1: Create the file**

```tsx
// character/app/components/LipSyncController.tsx

import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { createLipSyncAnalyzer } from 'wawa-lipsync';

// Viseme → VRM blend shape preset name mapping
const VISEME_TO_VRM: Record<string, string | null> = {
  // Silence
  sil: null,
  // Bilabials
  PP: VRMExpressionPresetName.Ou,
  FF: VRMExpressionPresetName.Ou,
  // Open vowels
  aa: VRMExpressionPresetName.Aa,
  E:  VRMExpressionPresetName.Ee,
  I:  VRMExpressionPresetName.Ih,
  O:  VRMExpressionPresetName.Oh,
  U:  VRMExpressionPresetName.Ou,
  // Consonants — map to nearest vowel shape
  TH: VRMExpressionPresetName.Ee,
  DD: VRMExpressionPresetName.Ee,
  kk: VRMExpressionPresetName.Ee,
  CH: VRMExpressionPresetName.Ee,
  SS: VRMExpressionPresetName.Ee,
  nn: VRMExpressionPresetName.Ih,
  RR: VRMExpressionPresetName.Ih,
};

// Intensity scale per viseme
const VISEME_INTENSITY: Record<string, number> = {
  aa: 1.0,
  E: 0.8,
  I: 0.7,
  O: 0.8,
  U: 0.7,
  PP: 0.4,
  FF: 0.4,
  TH: 0.5, DD: 0.5, kk: 0.5, CH: 0.5, SS: 0.5, nn: 0.5, RR: 0.5,
};

interface LipSyncControllerProps {
  vrm: VRM;
}

export function LipSyncController({ vrm }: LipSyncControllerProps) {
  const analyzerRef = useRef<ReturnType<typeof createLipSyncAnalyzer> | null>(null);
  const currentViseme = useRef<string>('sil');
  const targetWeight = useRef<number>(0);
  const currentWeight = useRef<number>(0);
  const currentVRMShape = useRef<string | null>(null);

  // Called by AudioPlayer when a new source node is ready
  const connectSource = useCallback((source: AudioBufferSourceNode, ctx: AudioContext) => {
    // Clean up previous analyzer
    if (analyzerRef.current) {
      analyzerRef.current.destroy?.();
    }

    analyzerRef.current = createLipSyncAnalyzer(ctx, source, {
      onViseme: (viseme: string) => {
        currentViseme.current = viseme;
        targetWeight.current = VISEME_INTENSITY[viseme] ?? 0;
      },
    });
  }, []);

  // Called by AudioPlayer when playback ends
  const onEnd = useCallback(() => {
    currentViseme.current = 'sil';
    targetWeight.current = 0;
  }, []);

  useFrame((_, delta) => {
    const em = vrm.expressionManager;
    if (!em) return;

    const viseme = currentViseme.current;
    const vrmShape = VISEME_TO_VRM[viseme] ?? null;

    // Smooth transition
    const lerpSpeed = 25 * delta; // fast enough for speech rhythm
    currentWeight.current = THREE_LERP(currentWeight.current, targetWeight.current, Math.min(lerpSpeed, 1));

    // Clear previous viseme shape
    if (currentVRMShape.current && currentVRMShape.current !== vrmShape) {
      em.setValue(currentVRMShape.current, 0);
    }

    // Apply current viseme
    if (vrmShape) {
      em.setValue(vrmShape, currentWeight.current);
    }
    currentVRMShape.current = vrmShape;

    em.update();
  });

  return { connectSource, onEnd };
}

// Simple lerp helper (avoid importing THREE for one function)
function THREE_LERP(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/LipSyncController.tsx
git commit -m "feat: add LipSyncController with wawa-lipsync viseme mapping"
```

---

## Task 4: Wire AudioPlayer + LipSyncController into VRMAvatar

**Files:**
- Modify: `character/app/components/VRMAvatar.tsx`

- [ ] **Step 1: Update VRMScene to include both controllers**

In `VRMAvatar.tsx`, update `VRMScene` to render `AudioPlayer` outside the Canvas (it doesn't need 3D context) and `LipSyncController` inside:

```tsx
// Add imports:
import { AudioPlayer } from './AudioPlayer';
import { LipSyncController } from './LipSyncController';

// Modify VRMScene return:
function VRMScene({ modelPath, onReady, onError }: VRMSceneProps) {
  const [loadedVRM, setLoadedVRM] = useState<VRM | null>(null);
  const lipSyncRef = useRef<{ connectSource: Function; onEnd: Function } | null>(null);
  // ... existing loader code unchanged ...

  return loadedVRM ? (
    <>
      <ExpressionController vrm={loadedVRM} />
      <LipSyncControllerWrapper vrm={loadedVRM} lipSyncRef={lipSyncRef} />
    </>
  ) : null;
}

// Add a wrapper that captures ref:
function LipSyncControllerWrapper({ vrm, lipSyncRef }: { vrm: VRM; lipSyncRef: React.MutableRefObject<any> }) {
  const controller = LipSyncController({ vrm });
  lipSyncRef.current = controller;
  return null;
}
```

- [ ] **Step 2: Add AudioPlayer outside Canvas in VRMAvatar JSX**

In the `VRMAvatar` return JSX, add `AudioPlayer` as a sibling to `Canvas`:

```tsx
return (
  <div className={className} style={{ width, height }}>
    <AudioPlayer
      onSourceNodeReady={(source, ctx) => {
        // Forward to LipSyncController via a ref or context
        // We'll use a window event for simplicity
        window.dispatchEvent(new CustomEvent('vrm-audio-source', { detail: { source, ctx } }));
      }}
      onPlaybackEnd={() => {
        window.dispatchEvent(new CustomEvent('vrm-audio-end'));
      }}
    />
    <Canvas ...>
      {/* existing Canvas content */}
    </Canvas>
  </div>
);
```

- [ ] **Step 3: Update LipSyncController to listen to window events**

Instead of using refs across component boundaries, update `LipSyncController.tsx` to listen for the `vrm-audio-source` custom event:

```tsx
// In LipSyncController, add to useEffect:
useEffect(() => {
  const handleSource = (e: CustomEvent) => {
    connectSource(e.detail.source, e.detail.ctx);
  };
  const handleEnd = () => { onEnd(); };

  window.addEventListener('vrm-audio-source', handleSource as EventListener);
  window.addEventListener('vrm-audio-end', handleEnd);
  return () => {
    window.removeEventListener('vrm-audio-source', handleSource as EventListener);
    window.removeEventListener('vrm-audio-end', handleEnd);
  };
}, [connectSource, onEnd]);

return null;  // Return null, not an object
```

Update `LipSyncController` to be a proper React component (return `null` instead of object).

- [ ] **Step 4: TypeScript check**

```bash
cd character
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add app/components/VRMAvatar.tsx app/components/LipSyncController.tsx
git commit -m "feat: wire AudioPlayer and LipSyncController into VRMAvatar"
```

---

## Task 5: Modify TTSQueue in EmoMate

**Files:**
- Modify: `EmoMate/src/capabilities/speak/queue/TTSQueue.ts`

- [ ] **Step 1: Add WebView ref to TTSQueue**

TTSQueue needs a reference to the WebView to post the `playAudio` message. Add a `setWebViewRef` method:

```typescript
// Add to TTSQueue class:
import * as FileSystem from 'expo-file-system';

private webViewPostMessage?: (message: string) => void;
private pendingAudioResolvers = new Map<string, () => void>();

/**
 * Set the WebView postMessage function for audio routing
 */
setWebViewPostMessage(fn: (message: string) => void) {
  this.webViewPostMessage = fn;
}

/**
 * Called when WebView signals audioComplete
 */
onAudioComplete(id: string) {
  const resolver = this.pendingAudioResolvers.get(id);
  if (resolver) {
    this.pendingAudioResolvers.delete(id);
    resolver();
  }
}
```

- [ ] **Step 2: Find the playNext method and modify it**

In `TTSQueue.ts`, find the `playNext` method (where `audioPlayer.playAsync()` or similar is called). Replace the audio playback section:

```typescript
// Find the section where audio is played (look for Sound.createAsync or similar)
// Replace it with:

private async playAudioViaWebView(item: TTSQueueItem): Promise<void> {
  if (!this.webViewPostMessage || !item.audioUri) {
    throw new Error('WebView not available or no audio URI');
  }

  const base64 = await FileSystem.readAsStringAsync(item.audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const id = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const message = JSON.stringify({
    type: 'playAudio',
    data: { audioBase64: base64, mimeType: 'audio/mpeg', id },
  });

  // Create promise that resolves when audioComplete arrives
  const completionPromise = new Promise<void>((resolve) => {
    this.pendingAudioResolvers.set(id, resolve);
    // Timeout fallback: resolve after estimated duration + buffer
    setTimeout(() => {
      this.pendingAudioResolvers.delete(id);
      resolve();
    }, 60000); // 60s max timeout
  });

  this.webViewPostMessage(message);
  await completionPromise;
}
```

- [ ] **Step 3: In playNext, call playAudioViaWebView**

Find where the queue item is played. Replace the existing play call:

```typescript
// In playNext or equivalent, find the play section:
// OLD: await someAudioPlayer.play(item.audioUri)
// NEW:
await this.playAudioViaWebView(item);
```

- [ ] **Step 4: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add EmoMate/src/capabilities/speak/queue/TTSQueue.ts
git commit -m "feat: route TTS audio through WebView bridge for lip sync"
```

---

## Task 6: Wire audioComplete in HiyoriWebView

**Files:**
- Modify: `EmoMate/src/components/HiyoriWebView.tsx`

- [ ] **Step 1: Connect TTSQueue to WebView in HiyoriWebView**

In `HiyoriWebView.tsx`, the component holds `webViewRef`. We need to:
1. Pass `webViewRef.current.postMessage` to TTSQueue when ready
2. Forward `audioComplete` messages from WebView to TTSQueue

Find where `onMessage` handles bridge messages and add:

```typescript
// In the onMessage handler switch/if-else, add:
case 'audioComplete':
  // Forward to TTSQueue
  if (message.data?.id) {
    ttsQueueRef.current?.onAudioComplete(message.data.id);
  }
  break;

case 'lipSyncStart':
  debugLog('HiyoriWebView', 'Lip sync started');
  break;

case 'lipSyncEnd':
  debugLog('HiyoriWebView', 'Lip sync ended');
  break;
```

- [ ] **Step 2: Pass postMessage to TTSQueue after WebView loads**

In `HiyoriWebView.tsx`, when `isWebViewReady` becomes true, set the WebView post message on TTSQueue:

```typescript
// In the effect that runs when isWebViewReady changes:
useEffect(() => {
  if (state.isWebViewReady && webViewRef.current) {
    const postFn = (msg: string) => webViewRef.current?.postMessage(msg);
    // Access TTSQueue instance — this depends on where it's instantiated
    // If TTSQueue is passed as prop:
    props.ttsQueue?.setWebViewPostMessage(postFn);
  }
}, [state.isWebViewReady]);
```

Note: The exact wiring depends on how TTSQueue is instantiated in your app. Check `HomeScreen.tsx` or `useChatAI.ts` for where TTSQueue is created, and pass the setter function accordingly.

- [ ] **Step 3: Commit**

```bash
git add EmoMate/src/components/HiyoriWebView.tsx
git commit -m "feat: forward audioComplete to TTSQueue, wire WebView postMessage"
```

---

## Verification Checklist

Test each item after completing all tasks:

- [ ] `npm run dev` in `character/` starts without errors
- [ ] DevTools Console: run `window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'playAudio', data: { audioBase64: '<base64_of_any_mp3>', mimeType: 'audio/mpeg', id: 'test1' } }) }))` → mouth moves
- [ ] Mouth closes after audio ends
- [ ] TTSQueue advances to next item after `audioComplete` is received
- [ ] Sending a message in EmoMate causes character to speak with mouth sync
- [ ] No double audio (audio plays only in WebView, not also in RN)
- [ ] Expressions and lip sync work simultaneously (smile + mouth moving)
- [ ] `npx tsc --noEmit` passes in both `character/` and `EmoMate/`

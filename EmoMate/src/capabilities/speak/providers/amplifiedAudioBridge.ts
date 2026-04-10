// src/capabilities/speak/providers/amplifiedAudioBridge.ts
// Singleton bridge between FishAudioProvider and the hidden WebView audio player.
// Native → WebView: injectJavaScript calling window.handleNativeMessage
// WebView → Native: window.ReactNativeWebView.postMessage → onMessage prop

import WebView from 'react-native-webview';

export const AUDIO_GAIN = 3.0; // 300% volume amplification

type PlayCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
};

class AmplifiedAudioBridge {
  private webviewRef: WebView | null = null;
  private pendingCallbacks = new Map<string, PlayCallbacks>();
  private currentPlayId: string | null = null;

  register(ref: WebView | null) {
    this.webviewRef = ref;
  }

  isReady(): boolean {
    return this.webviewRef !== null;
  }

  warmup() {
    this.send({ type: 'warmup' });
  }

  play(base64: string, gain: number, callbacks: PlayCallbacks): void {
    // Fail fast if WebView not mounted yet — avoids hanging Promise in FishAudioProvider
    if (!this.webviewRef) {
      callbacks.onError?.(new Error('AmplifiedAudioBridge: WebView not ready'));
      return;
    }
    const id = `play_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.currentPlayId = id;
    this.pendingCallbacks.set(id, callbacks);
    this.send({ type: 'play', id, data: base64, gain });
  }

  stop(): void {
    // Clear ALL pending callbacks to prevent Map leak on cancel/stop cycles
    this.pendingCallbacks.clear();
    this.currentPlayId = null;
    this.send({ type: 'stop' });
  }

  // Called by AmplifiedAudioPlayer's onMessage
  handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);
      const callbacks = this.pendingCallbacks.get(msg.id);
      if (msg.type === 'started') {
        callbacks?.onStart?.();
      } else if (msg.type === 'ended') {
        callbacks?.onEnd?.();
        this.pendingCallbacks.delete(msg.id);
        if (this.currentPlayId === msg.id) this.currentPlayId = null;
      } else if (msg.type === 'error') {
        callbacks?.onError?.(new Error(msg.error || 'Playback error'));
        this.pendingCallbacks.delete(msg.id);
        if (this.currentPlayId === msg.id) this.currentPlayId = null;
      }
    } catch (e) {
      console.warn('[AmplifiedAudioBridge] Failed to parse message:', data, e);
    }
  }

  private send(msg: object) {
    if (!this.webviewRef) {
      console.warn('[AmplifiedAudioBridge] WebView not registered');
      return;
    }
    // Double-stringify produces a valid JS string literal, avoiding escaping issues
    const js = `window.handleNativeMessage(${JSON.stringify(JSON.stringify(msg))}); true;`;
    this.webviewRef.injectJavaScript(js);
  }
}

export const amplifiedAudioBridge = new AmplifiedAudioBridge();

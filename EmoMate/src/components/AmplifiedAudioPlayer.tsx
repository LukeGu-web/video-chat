// src/components/AmplifiedAudioPlayer.tsx
// Hidden WebView for amplified audio playback.
// Uses <audio> element (bypasses AudioContext suspension requirement) +
// attempts to connect MediaElementAudioSourceNode → GainNode for 3x amplification.

import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import { amplifiedAudioBridge } from '../capabilities/speak/providers/amplifiedAudioBridge';

const HTML = `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:transparent;overflow:hidden">
<script>
var ctx = null;
var gainNode = null;
var currentAudio = null;
var currentSourceNode = null; // track for proper disconnect between plays

function log(msg) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', msg: msg }));
}

function tryInitAudioContext(gain) {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = ctx.createGain();
    gainNode.gain.value = gain;
    gainNode.connect(ctx.destination);
    log('AudioContext created, state=' + ctx.state);
  } catch(e) {
    log('AudioContext init failed: ' + e.message);
  }
}

window.handleNativeMessage = function(jsonStr) {
  var msg;
  try { msg = JSON.parse(jsonStr); } catch(e) { return; }

  if (msg.type === 'warmup') {
    tryInitAudioContext(3.0);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    return;
  }

  if (msg.type === 'stop') {
    if (currentSourceNode) {
      currentSourceNode.disconnect();
      currentSourceNode = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    return;
  }

  if (msg.type === 'play') {
    var id = msg.id;
    var gain = msg.gain || 3.0;
    log('play received id=' + id);

    // Disconnect previous source node before cleanup to avoid AudioGraph accumulation
    if (currentSourceNode) {
      currentSourceNode.disconnect();
      currentSourceNode = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }

    tryInitAudioContext(gain);
    if (gainNode) gainNode.gain.value = gain;

    var audio = new Audio();
    audio.src = 'data:audio/mpeg;base64,' + msg.data;
    currentAudio = audio;

    // connectGain: attach MediaElementAudioSourceNode → GainNode and fire 'started'.
    // Called from the 'play' event so gain is always applied before onStart fires.
    function connectGainAndNotifyStarted() {
      if (ctx && gainNode) {
        try {
          var src = ctx.createMediaElementSource(audio);
          currentSourceNode = src;
          src.connect(gainNode);
          log('gain connected');
        } catch(e) {
          log('createMediaElementSource failed: ' + e.message);
        }
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'started', id: id }));
    }

    // Use the 'play' event (not play().then) to guarantee gain connection happens
    // before 'started' is reported to native, and to properly unlock AudioContext.
    audio.addEventListener('play', function() {
      log('audio play event, ctx.state=' + (ctx ? ctx.state : 'none'));
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(function() {
          log('ctx resumed in onplay');
          connectGainAndNotifyStarted();
        }).catch(function(e) {
          log('ctx.resume failed: ' + e.message);
          connectGainAndNotifyStarted(); // still notify even if resume fails
        });
      } else {
        connectGainAndNotifyStarted();
      }
    });

    audio.addEventListener('ended', function() {
      log('audio ended id=' + id);
      currentSourceNode = null;
      currentAudio = null;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended', id: id }));
    });

    audio.addEventListener('error', function(e) {
      var code = audio.error ? audio.error.code : 'unknown';
      log('audio error code=' + code + ' id=' + id);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error', id: id, error: 'audio error code=' + code
      }));
    });

    // Only handle rejection here; success is reported via the 'play' event above
    audio.play().catch(function(e) {
      log('play() rejected: ' + e.message);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error', id: id, error: e.message
      }));
    });
  }
};
</script>
</body>
</html>`;

export function AmplifiedAudioPlayer() {
  const webViewRef = useRef<WebView>(null);

  return (
    <View style={styles.container} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ html: HTML }}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        onLoadEnd={() => {
          amplifiedAudioBridge.register(webViewRef.current);
          amplifiedAudioBridge.warmup();
        }}
        onMessage={(e) => {
          const data = e.nativeEvent.data;
          try {
            const msg = JSON.parse(data);
            if (msg.type === 'log') {
              console.log('[AmplifiedAudioPlayer WebView]', msg.msg);
              return;
            }
            // 'ready' is an internal warmup ack — no callback to dispatch
            if (msg.type === 'ready') return;
          } catch (_) {}
          amplifiedAudioBridge.handleMessage(data);
        }}
        pointerEvents="none"
        style={styles.container}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
});

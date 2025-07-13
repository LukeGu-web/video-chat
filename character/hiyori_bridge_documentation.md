# Hiyori JavaScript Bridge Documentation

## Overview

The Hiyori JavaScript Bridge provides a global interface to control the Hiyori Live2D model from external JavaScript code. This allows other applications, browser extensions, or developer console commands to interact with the Hiyori model.

## Interface

The bridge is available globally as `window.HiyoriBridge` after the Hiyori model is loaded.

### Methods

#### `playMotion(motionName: string)`

Plays a specific motion animation on the Hiyori model.

**Parameters:**
- `motionName` (string): Name of the motion to play

**Available Motions:**
- `Idle` - Default peaceful state
- `Happy` - Cheerful and joyful animation
- `Surprised` - Surprised reaction
- `Shy` - Shy/embarrassed response
- `Wave` - Friendly greeting wave
- `Dance` - Dancing motion
- `Laugh` - Laughing animation
- `Thinking` - Thoughtful pose
- `Speaking` - Speaking animation
- `Excited` - Excited animation
- `Sleepy` - Sleepy animation

**Returns:** Motion result (Promise or boolean)

**Example:**
```javascript
window.HiyoriBridge.playMotion('Happy');
window.HiyoriBridge.playMotion('Speaking');
```

#### `getAvailableMotions()`

Returns a list of all available motion names.

**Returns:** Array of motion names (string[])

**Example:**
```javascript
const motions = window.HiyoriBridge.getAvailableMotions();
console.log('Available motions:', motions);
// Output: ['Idle', 'Happy', 'Surprised', 'Shy', 'Wave', 'Dance', 'Laugh', 'Thinking', 'Speaking', 'Excited', 'Sleepy']
```

#### `isModelLoaded()`

Checks if the Hiyori model is fully loaded and ready for commands.

**Returns:** Boolean indicating if model is loaded

**Example:**
```javascript
if (window.HiyoriBridge.isModelLoaded()) {
    window.HiyoriBridge.playMotion('Wave');
} else {
    console.log('Model not loaded yet');
}
```

## Usage Examples

### Basic Usage

```javascript
// Check if bridge is available
if (window.HiyoriBridge) {
    // Check if model is loaded
    if (window.HiyoriBridge.isModelLoaded()) {
        // Play a motion
        window.HiyoriBridge.playMotion('Happy');
    }
}
```

### Get All Available Motions

```javascript
// List all available motions
const motions = window.HiyoriBridge?.getAvailableMotions();
motions?.forEach(motion => {
    console.log(`Available motion: ${motion}`);
});
```

### Random Motion Player

```javascript
// Play random motions
function playRandomMotion() {
    if (window.HiyoriBridge?.isModelLoaded()) {
        const motions = window.HiyoriBridge.getAvailableMotions();
        const randomMotion = motions[Math.floor(Math.random() * motions.length)];
        window.HiyoriBridge.playMotion(randomMotion);
        console.log(`Playing random motion: ${randomMotion}`);
    }
}

// Play random motion every 5 seconds
setInterval(playRandomMotion, 5000);
```

### Sequential Motion Playback

```javascript
// Play motions in sequence
async function playMotionSequence(motions, delay = 3000) {
    for (const motion of motions) {
        if (window.HiyoriBridge?.isModelLoaded()) {
            window.HiyoriBridge.playMotion(motion);
            console.log(`Playing: ${motion}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Example: Play greeting sequence
playMotionSequence(['Wave', 'Happy', 'Thinking'], 2000);
```

## Integration with React Native WebView

The main page (`/`) is optimized for embedding in React Native WebView. It only displays the Hiyori model without any control panels, and all interactions are handled through the JavaScript Bridge.

### React Native WebView Setup

```javascript
import { WebView } from 'react-native-webview';

function HiyoriWebView() {
  const webViewRef = useRef(null);

  // Function to send commands to Hiyori
  const playMotion = (motionName) => {
    const jsCode = `
      if (window.HiyoriBridge && window.HiyoriBridge.isModelLoaded()) {
        window.HiyoriBridge.playMotion('${motionName}');
      } else {
        console.warn('Hiyori model not loaded yet');
      }
    `;
    webViewRef.current?.injectJavaScript(jsCode);
  };

  // Function to check available motions
  const getAvailableMotions = () => {
    const jsCode = `
      if (window.HiyoriBridge) {
        const motions = window.HiyoriBridge.getAvailableMotions();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'availableMotions',
          data: motions
        }));
      }
    `;
    webViewRef.current?.injectJavaScript(jsCode);
  };

  // Handle messages from WebView
  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'availableMotions') {
        console.log('Available motions:', message.data);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: 'YOUR_APP_URL' }} // Replace with your app URL
      onMessage={handleMessage}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={true}
      style={{ flex: 1 }}
    />
  );
}

// Usage examples:
// playMotion('Happy');
// playMotion('Speaking');
// getAvailableMotions();
```

### React Native Command Examples

```javascript
// Play different motions
playMotion('Happy');
playMotion('Surprised');
playMotion('Speaking');
playMotion('Wave');

// Check if model is loaded before sending commands
const checkAndPlay = (motionName) => {
  const jsCode = `
    (function() {
      if (window.HiyoriBridge) {
        if (window.HiyoriBridge.isModelLoaded()) {
          window.HiyoriBridge.playMotion('${motionName}');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'motionResult',
            motion: '${motionName}',
            success: true
          }));
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'motionResult',
            motion: '${motionName}',
            success: false,
            error: 'Model not loaded'
          }));
        }
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'motionResult',
          motion: '${motionName}',
          success: false,
          error: 'Bridge not available'
        }));
      }
    })();
  `;
  webViewRef.current?.injectJavaScript(jsCode);
};
```

### WebView Communication Pattern

```javascript
// Complete WebView component with error handling
import React, { useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';

const HiyoriController = () => {
  const webViewRef = useRef(null);

  // Wait for model to load, then start interaction
  useEffect(() => {
    const checkModelLoaded = () => {
      const jsCode = `
        (function checkModel() {
          if (window.HiyoriBridge && window.HiyoriBridge.isModelLoaded()) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'modelReady',
              ready: true
            }));
          } else {
            setTimeout(checkModel, 500);
          }
        })();
      `;
      webViewRef.current?.injectJavaScript(jsCode);
    };

    // Start checking after WebView loads
    setTimeout(checkModelLoaded, 2000);
  }, []);

  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'modelReady':
          console.log('Hiyori model is ready!');
          // Now you can safely send commands
          playMotion('Wave'); // Welcome animation
          break;
          
        case 'motionResult':
          console.log(`Motion ${message.motion}:`, message.success ? 'Success' : message.error);
          break;
          
        default:
          console.log('Unknown message:', message);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const playMotion = (motionName) => {
    const jsCode = `window.HiyoriBridge?.playMotion('${motionName}');`;
    webViewRef.current?.injectJavaScript(jsCode);
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: 'http://your-domain.com' }}
      onMessage={handleWebViewMessage}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      mixedContentMode="compatibility"
      style={{ flex: 1 }}
    />
  );
};
```

## Integration with External Applications

### Browser Extension

```javascript
// In a browser extension content script
function controlHiyori(command, motionName) {
    if (command === 'playMotion' && window.HiyoriBridge) {
        return window.HiyoriBridge.playMotion(motionName);
    }
}

// Listen for messages from extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'playMotion') {
        const result = controlHiyori('playMotion', request.motion);
        sendResponse({success: true, result});
    }
});
```

### Bookmarklet

```javascript
// Create a bookmarklet to control Hiyori
javascript:(function(){
    if(window.HiyoriBridge && window.HiyoriBridge.isModelLoaded()) {
        const motion = prompt('Enter motion name:', 'Happy');
        if(motion) {
            window.HiyoriBridge.playMotion(motion);
        }
    } else {
        alert('Hiyori model not loaded');
    }
})();
```

## Browser Console Commands

Open the browser console (F12) on the Hiyori page and try these commands:

```javascript
// Check if bridge is available
window.HiyoriBridge

// Play specific motions
window.HiyoriBridge.playMotion('Happy')
window.HiyoriBridge.playMotion('Speaking')
window.HiyoriBridge.playMotion('Dance')

// Get available motions
window.HiyoriBridge.getAvailableMotions()

// Check model status
window.HiyoriBridge.isModelLoaded()
```

## Error Handling

Always check if the bridge is available and the model is loaded before calling methods:

```javascript
function safePlayMotion(motionName) {
    try {
        if (!window.HiyoriBridge) {
            console.warn('HiyoriBridge not available');
            return false;
        }
        
        if (!window.HiyoriBridge.isModelLoaded()) {
            console.warn('Hiyori model not loaded yet');
            return false;
        }
        
        const result = window.HiyoriBridge.playMotion(motionName);
        console.log(`Motion "${motionName}" played successfully:`, result);
        return true;
    } catch (error) {
        console.error('Error playing motion:', error);
        return false;
    }
}
```

## Notes

- The bridge is automatically initialized when the Hiyori model finishes loading
- The bridge is cleaned up when the component unmounts
- All bridge commands are logged to the console for debugging
- The bridge only supports motion commands currently; parameter and expression controls are available through the component's direct interface
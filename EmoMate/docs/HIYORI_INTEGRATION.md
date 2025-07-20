# Hiyori Live2D Integration for EmoMate

This document explains how to integrate and use the Hiyori Live2D character in the EmoMate React Native application.

## Components Overview

### 1. HiyoriWebView
The main component that embeds the Hiyori Live2D model via WebView.

**Location:** `src/components/HiyoriWebView.tsx`

**Features:**
- Loads Hiyori from local development server (http://localhost:5173/)
- JavaScript Bridge communication
- Model ready status tracking
- Motion control interface
- Error handling and loading states

### 2. HiyoriScreen
A complete screen showcasing Hiyori with full control panel.

**Location:** `src/screens/HiyoriScreen.tsx`

**Features:**
- Full-screen Hiyori display
- Motion control buttons
- Status indicators
- Random motion player

### 3. HiyoriIntegrationExample
An example showing how to integrate Hiyori with other app features.

**Location:** `src/components/HiyoriIntegrationExample.tsx`

**Features:**
- Emotion-based auto reactions
- Speaking state integration
- Simple API for other components

## Setup Instructions

### 1. Install Dependencies

Make sure you have `react-native-webview` installed:

```bash
npm install react-native-webview
# or
yarn add react-native-webview
```

For iOS, also run:
```bash
cd ios && pod install
```

### 2. Start Local Development Server

Make sure your Hiyori web application is running on port 5173:

```bash
cd /path/to/video-chat/character
npm run dev
```

The server should be accessible at `http://localhost:5173/`

### 3. Import and Use Components

```tsx
import { HiyoriWebView, HiyoriScreen } from '../src/components';
import { HiyoriScreen } from '../src/screens';
```

## Usage Examples

### Basic Usage

```tsx
import React, { useRef } from 'react';
import { View } from 'react-native';
import HiyoriWebView from '../components/HiyoriWebView';

const MyScreen = () => {
  const hiyoriRef = useRef(null);

  const handleModelReady = () => {
    console.log('Hiyori is ready!');
    // Play welcome animation
    hiyoriRef.current?.hiyoriBridge?.playMotion('Wave');
  };

  return (
    <View style={{ flex: 1 }}>
      <HiyoriWebView
        ref={hiyoriRef}
        onModelReady={handleModelReady}
        onMotionResult={(motion, success, error) => {
          console.log(`Motion ${motion}: ${success ? 'Success' : error}`);
        }}
      />
    </View>
  );
};
```

### Integration with Chat Features

```tsx
import React, { useRef, useEffect } from 'react';
import HiyoriWebView from '../components/HiyoriWebView';

const ChatWithHiyori = () => {
  const hiyoriRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');

  // React to speaking state
  useEffect(() => {
    if (isSpeaking) {
      hiyoriRef.current?.hiyoriBridge?.playMotion('Speaking');
    } else {
      hiyoriRef.current?.hiyoriBridge?.playMotion('Idle');
    }
  }, [isSpeaking]);

  // React to emotion changes
  useEffect(() => {
    const emotionMotions = {
      happy: 'Happy',
      sad: 'Sleepy',
      excited: 'Excited',
      surprised: 'Surprised',
    };
    
    const motion = emotionMotions[currentEmotion] || 'Idle';
    hiyoriRef.current?.hiyoriBridge?.playMotion(motion);
  }, [currentEmotion]);

  return (
    <HiyoriWebView
      ref={hiyoriRef}
      onModelReady={() => {
        hiyoriRef.current?.hiyoriBridge?.playMotion('Wave');
      }}
    />
  );
};
```

### Full Screen Experience

```tsx
import React from 'react';
import { HiyoriScreen } from '../screens';

const App = () => {
  return <HiyoriScreen />;
};
```

## Available Motions

- `Idle` - Default peaceful state
- `Happy` - Cheerful and joyful
- `Surprised` - Surprised reaction
- `Shy` - Shy/embarrassed response
- `Wave` - Friendly greeting wave
- `Dance` - Dancing motion
- `Laugh` - Laughing animation
- `Thinking` - Thoughtful pose
- `Speaking` - Speaking animation
- `Excited` - Excited animation
- `Sleepy` - Sleepy animation

## API Reference

### HiyoriWebView Props

```tsx
interface HiyoriWebViewProps {
  style?: any;
  onModelReady?: () => void;
  onMotionResult?: (motion: string, success: boolean, error?: string) => void;
}
```

### HiyoriBridge Interface

```tsx
interface HiyoriBridge {
  playMotion: (motionName: string) => void;
  getAvailableMotions: () => void;
  checkModelStatus: () => void;
}
```

### Accessing the Bridge

```tsx
// Through ref
hiyoriRef.current?.hiyoriBridge?.playMotion('Happy');

// Check if model is ready
const isReady = hiyoriRef.current?.hiyoriBridge?.checkModelStatus();
```

## Navigation Integration

To add HiyoriScreen to your navigation:

```tsx
// In your navigation stack
import { HiyoriScreen } from '../screens';

const Stack = createStackNavigator();

function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen 
        name="Hiyori" 
        component={HiyoriScreen}
        options={{ title: 'Hiyori Live2D' }}
      />
    </Stack.Navigator>
  );
}
```

## Troubleshooting

### Common Issues

1. **WebView not loading:**
   - Make sure the development server is running on port 5173
   - Check network permissions in your app
   - Verify the URL is accessible from your device/emulator

2. **Model not responding:**
   - Wait for the `onModelReady` callback before sending commands
   - Check console logs for JavaScript errors
   - Ensure the Hiyori web app is working in browser first

3. **Bridge not available:**
   - The bridge is initialized after the model loads
   - Always check `isModelReady` before calling bridge methods

### Debug Mode

In development builds, you can enable debug information:

```tsx
<HiyoriWebView
  // ... other props
  onMessage={(event) => {
    console.log('WebView message:', event.nativeEvent.data);
  }}
/>
```

## Performance Notes

- The WebView loads a full Live2D application, so initial loading may take a few seconds
- Consider showing loading indicators while the model initializes
- For production, consider hosting the Hiyori web app on a CDN instead of localhost

## Next Steps

1. Integrate with your existing chat features
2. Add emotion detection from text/voice
3. Create custom motion sequences
4. Add parameter controls (eye movement, expressions)
5. Implement background scenes or environments
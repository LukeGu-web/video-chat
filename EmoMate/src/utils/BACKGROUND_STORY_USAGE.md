# Background Story System - Usage Examples

## 🎯 Quick Start

### 1. Generate Background Context on App Start

```typescript
import { generateBackgroundContext, formatStoryForAI } from '@/utils/backgroundStory';

// In your HiyoriScreen or App initialization
useEffect(() => {
  const initializeBackground = async () => {
    try {
      const context = await generateBackgroundContext();

      // Use the background image
      setBackgroundImage(context.imagePath);

      // Add story to AI system message
      const storyMessage = formatStoryForAI(context);
      console.log('Background story:', context.story);

      // Store context for later use
      setBackgroundContext(context);
    } catch (error) {
      console.error('Failed to generate background:', error);
    }
  };

  initializeBackground();
}, []);
```

### 2. Display Background Image

```typescript
import { getBackgroundImageSource } from '@/utils/backgroundStory';
import { ImageBackground } from 'react-native';

function HiyoriScreen() {
  const [backgroundPath, setBackgroundPath] = useState('everyday/morning/bedroom.jpeg');

  return (
    <ImageBackground
      source={getBackgroundImageSource(backgroundPath)}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Your content here */}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
```

### 3. Integrate with AI Chat System

```typescript
import { formatStoryForAI } from '@/utils/backgroundStory';

// In your useChatAI hook or wherever you initialize the AI
const initializeAIWithBackground = async (context: BackgroundContext) => {
  const storyMessage = formatStoryForAI(context);

  // Add to system message
  const systemMessage = `
${lanlanPersonality}  // Your existing personality

${storyMessage}  // Background story
  `;

  // Use in your AI initialization
  // This will be part of the initial context sent to Claude AI
};
```

### 4. Refresh Background Periodically

```typescript
import { shouldRefreshBackground, generateBackgroundContext } from '@/utils/backgroundStory';

// In your screen component
useEffect(() => {
  const checkRefresh = setInterval(async () => {
    if (backgroundContext && shouldRefreshBackground(backgroundContext.timestamp)) {
      const newContext = await generateBackgroundContext();
      setBackgroundContext(newContext);
      setBackgroundImage(newContext.imagePath);

      // Optionally notify user or AI about context change
      console.log('Background refreshed:', newContext.story);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  return () => clearInterval(checkRefresh);
}, [backgroundContext]);
```

## 📱 Complete Integration Example

### Create a Background Context Hook

```typescript
// src/hooks/useBackgroundContext.ts
import { useState, useEffect } from 'react';
import {
  generateBackgroundContext,
  shouldRefreshBackground,
  type BackgroundContext,
} from '@/utils/backgroundStory';

export function useBackgroundContext() {
  const [context, setContext] = useState<BackgroundContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        const newContext = await generateBackgroundContext();
        setContext(newContext);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to generate background context:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // Auto-refresh every 5 minutes if needed
  useEffect(() => {
    const interval = setInterval(async () => {
      if (context && shouldRefreshBackground(context.timestamp)) {
        try {
          const newContext = await generateBackgroundContext();
          setContext(newContext);
        } catch (err) {
          console.error('Failed to refresh background:', err);
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [context]);

  // Manual refresh function
  const refresh = async () => {
    try {
      setIsLoading(true);
      const newContext = await generateBackgroundContext();
      setContext(newContext);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    context,
    isLoading,
    error,
    refresh,
  };
}
```

### Use in HiyoriScreen

```typescript
// src/screens/HiyoriScreen.tsx
import React from 'react';
import { ImageBackground, View, ActivityIndicator } from 'react-native';
import { useBackgroundContext } from '@/hooks/useBackgroundContext';
import { getBackgroundImageSource, formatStoryForAI } from '@/utils/backgroundStory';

export default function HiyoriScreen() {
  const { context, isLoading, error } = useBackgroundContext();

  if (isLoading || !context) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.error}>
        <Text>Failed to load background</Text>
      </View>
    );
  }

  // Get background image
  const backgroundSource = getBackgroundImageSource(context.imagePath);

  // Format story for AI (use this in your chat initialization)
  const aiStoryContext = formatStoryForAI(context);

  return (
    <ImageBackground
      source={backgroundSource}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Your existing HiyoriWebView and other components */}
      <HiyoriWebView />

      {/* Debug info (remove in production) */}
      {__DEV__ && (
        <View style={styles.debug}>
          <Text style={styles.debugText}>Scene: {context.scene.id}</Text>
          <Text style={styles.debugText}>Story: {context.story}</Text>
        </View>
      )}
    </ImageBackground>
  );
}
```

### Integrate with Chat AI

```typescript
// In src/utils/useChatAI.ts or wherever you initialize chat

import { formatStoryForAI } from '@/utils/backgroundStory';

export function useChatAI(backgroundContext?: BackgroundContext) {
  const initializeChat = useCallback(async () => {
    // Build system message
    let systemMessage = lanlanPersonality; // Your existing personality

    // Add background story if available
    if (backgroundContext) {
      const storyContext = formatStoryForAI(backgroundContext);
      systemMessage += '\n\n' + storyContext;
    }

    // Initialize AI with enhanced context
    // ... your existing chat initialization code
  }, [backgroundContext]);

  // ... rest of your chat logic
}
```

## 🎨 Advanced Usage

### Custom Scene Selection

```typescript
import { getSceneById, getScenesByTag } from '@/config/backgroundScenes';

// Select a specific scene
const nightScene = getSceneById('everyday_night_bedroom');

// Get all outdoor scenes
const outdoorScenes = getScenesByTag('outdoor');

// Get all cafe scenes
const cafeScenes = getScenesByTag('cafe');

// Randomly select from a category
const randomCafeScene = cafeScenes[Math.floor(Math.random() * cafeScenes.length)];
```

### Weather API Integration

```typescript
// src/utils/weatherService.ts
import type { WeatherType } from '@/config/backgroundScenes';

export async function fetchCurrentWeather(): Promise<WeatherType> {
  try {
    // Use a weather API (e.g., OpenWeatherMap)
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`
    );
    const data = await response.json();

    // Map API weather to our WeatherType
    const weatherMain = data.weather[0].main.toLowerCase();
    if (weatherMain.includes('clear')) return 'sunny';
    if (weatherMain.includes('rain')) return 'rainy';
    if (weatherMain.includes('cloud')) return 'cloudy';
    if (weatherMain.includes('snow')) return 'snowy';

    return 'default';
  } catch (error) {
    console.error('Weather fetch failed:', error);
    return 'default';
  }
}

// Update backgroundStory.ts to use real weather
async function getCurrentWeather(): Promise<WeatherType> {
  return await fetchCurrentWeather();
}
```

### Background Transition Animation

```typescript
import { Animated } from 'react-native';

function BackgroundWithTransition({ imagePath }: { imagePath: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade out -> change image -> fade in
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [imagePath]);

  return (
    <Animated.View style={{ opacity }}>
      <ImageBackground
        source={getBackgroundImageSource(imagePath)}
        style={styles.background}
      />
    </Animated.View>
  );
}
```

### Scene-Based Music/Sound

```typescript
import { Audio } from 'expo-av';

const SCENE_MUSIC: Record<string, any> = {
  'everyday_morning_bedroom': require('../../assets/sounds/morning_calm.mp3'),
  'weekend_day_cafe': require('../../assets/sounds/cafe_ambience.mp3'),
  'everyday_night_bedroom': require('../../assets/sounds/night_quiet.mp3'),
};

async function playSceneMusic(sceneId: string) {
  const musicFile = SCENE_MUSIC[sceneId];
  if (!musicFile) return;

  const { sound } = await Audio.Sound.createAsync(musicFile, {
    isLooping: true,
    volume: 0.3,
  });

  await sound.playAsync();
}
```

## 🐛 Debugging

### Enable Debug Overlay

```typescript
// Add to your screen component
{__DEV__ && (
  <View style={styles.debugOverlay}>
    <Text>Scene ID: {context.scene.id}</Text>
    <Text>Day Type: {context.scene.dayType}</Text>
    <Text>Time Period: {context.scene.timePeriod}</Text>
    <Text>Weather: {context.weather}</Text>
    <Text>Priority: {context.scene.priority}</Text>
    <Text>Image: {context.imagePath}</Text>
    <Text>Story: {context.story.substring(0, 50)}...</Text>
    <Button title="Refresh" onPress={refresh} />
  </View>
)}
```

### Log Scene Selection

```typescript
// In backgroundStory.ts, add logging to generateBackgroundContext
console.log('Scene selection:', {
  dayType,
  currentHour,
  weather,
  selectedScene: scene.id,
  allCandidates: SCENE_CONFIG
    .filter(s => s.dayType === dayType)
    .map(s => ({ id: s.id, priority: s.priority, timeRange: s.timeRange })),
});
```

## 📊 State Management (Optional)

### Using Zustand for Global State

```typescript
// src/store/backgroundStore.ts
import { create } from 'zustand';
import type { BackgroundContext } from '@/utils/backgroundStory';

interface BackgroundStore {
  context: BackgroundContext | null;
  setContext: (context: BackgroundContext) => void;
  refresh: () => Promise<void>;
}

export const useBackgroundStore = create<BackgroundStore>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
  refresh: async () => {
    const newContext = await generateBackgroundContext();
    set({ context: newContext });
  },
}));

// Use in any component
function MyComponent() {
  const { context, refresh } = useBackgroundStore();
  // ...
}
```

## ✅ Best Practices

1. **Initialize Early**: Generate background context as soon as the app starts or when entering HiyoriScreen
2. **Cache Context**: Store the current context to avoid regenerating unnecessarily
3. **Smooth Transitions**: Use animations when changing backgrounds
4. **Error Handling**: Always have fallback images and stories
5. **Performance**: Lazy load images, use appropriate image sizes
6. **Consistency**: Keep the background context in sync with the AI's memory
7. **User Experience**: Don't change background too frequently (30-minute intervals)

## 🔗 Related Files

- **Configuration**: `src/config/backgroundScenes.ts`
- **Story Generator**: `src/utils/backgroundStory.ts`
- **Guide**: `src/config/BACKGROUND_SCENES_GUIDE.md`
- **Assets**: `assets/background/`

---

**Ready to integrate?** Start with the Quick Start section and gradually add more advanced features!

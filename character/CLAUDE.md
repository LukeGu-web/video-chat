# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The **Character** project is a Remix-based web application that displays Live2D models, specifically designed to work with the Hiyori VTuber character. It serves as the WebView content for the EmoMate React Native application, providing an interactive Live2D character display with JavaScript Bridge communication.

### Current Development Status: 🚀 **Production-Ready**

- **Live2D Integration**: ✅ Complete with Hiyori model support
- **JavaScript Bridge**: ✅ Full React Native communication system
- **Motion Control**: ✅ Comprehensive animation system
- **Performance**: ✅ Optimized loading and rendering

## Development Commands

```bash
# Start development server (production mode)
npm run dev

# Start development server with debug mode
SHOW_TEST_COMPONENTS=true npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Debug Mode System

### Overview
The character project implements a comprehensive debug mode system that allows developers to view detailed logs, performance metrics, and status panels during development while keeping the production build clean.

### Environment Variable Configuration
Debug mode is controlled via the `SHOW_TEST_COMPONENTS` environment variable:

```bash
# Production mode (default) - No debug output
npm run dev

# Debug mode - Shows all debug information
SHOW_TEST_COMPONENTS=true npm run dev
```

### Configuration Files
- **`vite.config.ts`**: Defines environment variables and injects them into the build
- **`app/components/HiyoriLive2D.tsx`**: Main component with debug logic

### Debug Features

#### 1. Debug Status Panel
Visual status panel showing initialization progress:
- **DOM Ready**: ✓/⧗
- **Live2D Ready**: ✓/⧗  
- **Model Ready**: ✓/⧗
- **Bridge Ready**: ✓/⧗
- **All Ready**: ✓/⧗
- **Load Times**: Performance metrics in milliseconds

#### 2. Console Logging
Comprehensive logging system with component prefixes:
- **🌟 [HiyoriBridge]**: Bridge initialization and API calls
- **🎭 [HiyoriBridge]**: Motion execution and results
- **💓 [Heartbeat]**: Connection health monitoring
- **📋 [HiyoriBridge]**: Status checks and information
- **🔍 [HiyoriBridge]**: Detailed debugging information

#### 3. Performance Monitoring
Detailed timing metrics:
- DOM load time
- Live2D core load time
- Model load time
- Total initialization time
- Motion execution response time

#### 4. Error Reporting
Enhanced error reporting with:
- Detailed error messages
- Component stack traces
- Initialization stage identification
- Recovery suggestions

### Debug Mode Implementation

#### Environment Variable Setup
```typescript
// vite.config.ts
export default defineConfig({
  // ... other config
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.SHOW_TEST_COMPONENTS': JSON.stringify(process.env.SHOW_TEST_COMPONENTS || 'false'),
  },
});
```

#### Component Debug Logic
```typescript
// HiyoriLive2D.tsx
const isDebugMode = process.env.SHOW_TEST_COMPONENTS === 'true';

const debugLog = (stage: string, message: string, data?: any) => {
  if (!isDebugMode) return;
  const timestamp = Date.now() - startTime.current;
  console.log(`[Hiyori ${stage}][${timestamp}ms] ${message}`, data || '');
};

// Debug panel rendering
{isDebugMode && (
  <div className="debug-status-panel">
    {/* Status indicators */}
  </div>
)}
```

### Usage Guidelines

#### For Development
1. **Regular Development**: Use `npm run dev` for normal development
2. **Debug Mode**: Use `SHOW_TEST_COMPONENTS=true npm run dev` when:
   - Debugging initialization issues
   - Monitoring performance
   - Investigating bridge communication
   - Testing motion execution

#### For Production
- Production builds automatically exclude all debug code
- Environment variables are not included in production bundles
- Clean user interface without debug elements

### Network Configuration with Debug
When debugging network issues:
```bash
# Start with debug mode and check console for connection details
SHOW_TEST_COMPONENTS=true npm run dev
```

Debug logs will show:
- Server binding status (0.0.0.0:5174)
- WebView connection attempts
- Bridge initialization progress
- Motion command execution

### Best Practices

1. **Development Workflow**:
   - Use regular mode for normal development
   - Enable debug mode only when investigating issues
   - Monitor console for detailed operation logs

2. **Performance Testing**:
   - Check initialization times in debug mode
   - Monitor motion execution latency
   - Verify bridge communication efficiency

3. **Error Debugging**:
   - Enable debug mode when errors occur
   - Check both browser console and status panel
   - Use performance metrics to identify bottlenecks

## Architecture Overview

### Tech Stack
- **Remix 2.16.8** with React 18.2.0
- **TypeScript** in strict mode for type safety
- **Vite 6.0.0** for fast development and building
- **Tailwind CSS 3.4.4** for styling
- **PIXI.js 7.4.3** for WebGL rendering
- **pixi-live2d-display-mulmotion 0.5.0-mm-5** for Live2D model support

### Key Features
- **Live2D Model Display**: Hiyori VTuber character with full animation support
- **React Native Bridge**: Bi-directional communication with mobile app
- **Motion System**: 11+ predefined motions with real-time control
- **Interactive Controls**: Click/touch interaction with the character
- **Performance Monitoring**: Load time tracking and debugging support
- **Multi-stage Initialization**: DOM → Live2D → Model → Bridge → Ready

## Project Structure

```
character/
├── app/
│   ├── components/
│   │   ├── HiyoriLive2D.tsx     # Main Live2D component
│   │   └── ShizukuLive2D.tsx    # Alternative character (legacy)
│   ├── routes/
│   │   ├── _index.tsx           # Main route with HiyoriLive2D
│   │   ├── test.tsx            # Test routes for development
│   │   └── test2.tsx
│   ├── types/
│   │   └── live2d.d.ts         # Live2D type definitions
│   ├── entry.client.tsx        # Client-side entry point
│   ├── entry.server.tsx        # Server-side entry point
│   └── root.tsx                # Root layout component
├── public/
│   └── assets/
│       └── live2d/
│           └── hiyori_vts/     # Hiyori model files and animations
├── vite.config.ts              # Vite configuration with network settings
├── package.json                # Dependencies and scripts
└── tailwind.config.ts          # Tailwind CSS configuration
```

## Core Components

### HiyoriLive2D.tsx - Main Character Component

**Purpose**: Displays and controls the Hiyori Live2D model with full React Native communication.

#### Key Features:
- **Multi-stage Initialization**: DOM → Live2D Core → Model → Bridge → Ready
- **JavaScript Bridge**: Full bi-directional communication with React Native WebView
- **Motion Control**: 11 predefined motions (Idle, Happy, Surprised, Shy, Wave, Dance, Laugh, Thinking, Speaking, Excited, Sleepy)
- **Heart Beat System**: 5-second status updates to React Native
- **Performance Metrics**: Detailed load time tracking
- **Debug Support**: Console logging and visual status panel
- **Error Handling**: Comprehensive error reporting and recovery

#### State Management:
```typescript
interface ReadinessState {
  domReady: boolean;         // DOM loaded
  live2dReady: boolean;      // Live2D core loaded
  modelReady: boolean;       // Hiyori model loaded
  bridgeReady: boolean;      // JavaScript Bridge initialized
  allReady: boolean;         // All systems ready
}
```

#### JavaScript Bridge API:
```typescript
window.HiyoriBridge = {
  playMotion: (motionName: string) => any;
  getAvailableMotions: () => string[];
  isModelLoaded: () => boolean;
  getReadinessState: () => ReadinessState;
  getPerformanceMetrics: () => PerformanceMetrics;
  sendHeartbeat: () => void;
}
```

#### Message Protocol:
All communication uses structured JSON messages:
```typescript
interface BridgeMessage {
  id: string;           // Unique message ID
  type: string;         // Message type
  timestamp: number;    // Unix timestamp
  data?: any;          // Message payload
  error?: string;      // Error information
}
```

#### Supported Message Types:
- `domReady`: DOM initialization complete
- `readinessUpdate`: Incremental state updates
- `modelReady`: Full system ready
- `heartbeat`: Periodic status update (every 5s)
- `motionResult`: Animation execution result
- `userInteraction`: User click/touch events
- `initError`: Initialization errors
- `cleanup`: Component cleanup complete

## Live2D Integration

### Model Configuration
- **Character**: Hiyori VTuber
- **File**: `/assets/live2d/hiyori_vts/hiyori.model3.json`
- **Scaling**: 0.12x (optimized for mobile display)
- **Position**: Centered with slight vertical offset
- **Parts Management**: Automatic arm visibility control

### Motion System
Available motions mapped to emotions and actions:
```typescript
const availableMotions = [
  'Idle',      // Default state
  'Happy',     // Positive emotion
  'Surprised', // Reaction
  'Shy',       // Emotion
  'Wave',      // Greeting
  'Dance',     // Celebration
  'Laugh',     // Joy
  'Thinking',  // Contemplation
  'Speaking',  // Communication
  'Excited',   // High energy
  'Sleepy'     // Tired state
];
```

### Performance Optimization
- **Async Loading**: Non-blocking initialization
- **Resource Management**: Proper cleanup on unmount
- **Memory Efficiency**: Optimized PIXI application settings
- **Error Recovery**: Graceful fallback handling

## React Native Integration

### Communication Flow
1. **Initialization**: React Native WebView loads character app
2. **Handshake**: WebView signals readiness to React Native
3. **Bi-directional**: Both sides can send commands and receive responses
4. **Heartbeat**: Regular status updates maintain connection health

### Network Configuration
```typescript
// vite.config.ts
server: {
  host: '0.0.0.0',    // Listen on all interfaces
  port: 5174,         // Development port
}
```

### Development Setup
- Server runs on `http://192.168.31.28:5174/` for mobile access
- CORS enabled for cross-origin requests
- Hot reload supported for development

## Debugging and Monitoring

### Console Logging
Comprehensive logging system with emoji prefixes:
- `🌟 [HiyoriBridge]`: Bridge initialization
- `🎭 [HiyoriBridge]`: Motion execution
- `💓 [Heartbeat]`: Status updates
- `📋 [HiyoriBridge]`: API calls
- `🔍 [HiyoriBridge]`: Status checks

### Visual Debug Panel
Development-only status panel showing:
- DOM Ready: ✓/⧗
- Live2D Ready: ✓/⧗  
- Model Ready: ✓/⧗
- Bridge Ready: ✓/⧗
- All Ready: ✓/⧗
- Load Times: XXXms

### Performance Metrics
```typescript
interface PerformanceMetrics {
  domLoadTime: number;      // DOM ready time
  live2dLoadTime: number;   // Live2D core load time
  modelLoadTime: number;    // Model load time
  totalLoadTime: number;    // Total initialization time
}
```

## Error Handling

### Initialization Errors
- **Timeout Protection**: 10-second maximum wait for Live2D libraries
- **Graceful Degradation**: Error UI with retry options
- **Detailed Reporting**: Specific error messages for debugging

### Runtime Errors
- **Motion Failures**: Logged and reported to React Native
- **Bridge Errors**: Automatic error reporting via message system
- **Resource Cleanup**: Proper disposal of PIXI resources

## Development Workflow

### Hot Reload Development
1. Start development server: `npm run dev`
2. Server accessible at `http://localhost:5174/` and `http://192.168.31.28:5174/`
3. React Native WebView connects to network IP for testing
4. Changes automatically reload in both browser and mobile app

### Testing
- **Browser Testing**: Direct access via localhost for quick iteration
- **Mobile Testing**: React Native WebView integration
- **Debug Console**: All logs visible in browser developer tools
- **Network Testing**: Verify mobile device connectivity

### Production Build
```bash
npm run build        # Build optimized bundle
npm start           # Start production server
```

## Recent Achievements

### 🎯 Completed Features
- **Full Live2D Integration**: Hiyori model with 11 motion types
- **React Native Bridge**: Bi-directional communication system
- **Multi-stage Initialization**: Robust loading sequence
- **Performance Monitoring**: Detailed metrics and debugging
- **Error Recovery**: Comprehensive error handling
- **Heart Beat System**: Connection health monitoring
- **Interactive Controls**: Click/touch response system

### 🔧 Technical Improvements
- **TypeScript Integration**: Full type safety with Live2D types
- **Modern Build System**: Vite 6.0 with optimized bundling
- **Network Configuration**: Mobile-friendly development setup
- **Debug Infrastructure**: Comprehensive logging and status reporting
- **Memory Management**: Proper resource cleanup and disposal

### 📱 Mobile Optimization
- **Network Accessibility**: Server binds to 0.0.0.0 for mobile access
- **Touch Interaction**: Optimized for mobile touch events
- **Performance**: Smooth 60fps rendering on mobile devices
- **Error Handling**: Mobile-specific error reporting

## Integration Status

### EmoMate Integration: ✅ **Fully Functional**
- React Native WebView successfully loads character app
- Motion commands execute correctly
- Status updates work reliably
- Error handling provides user feedback
- Performance is smooth on mobile devices

### Communication Protocol: ✅ **Stable**
- Message format standardized and tested
- Bi-directional communication working
- Error recovery mechanisms in place
- Heartbeat system maintains connection health

## Development Guidelines

### Adding New Motions
1. Add motion name to `availableMotions` array
2. Ensure motion exists in Hiyori model files
3. Test motion execution via React Native interface
4. Update documentation with new motion

### Modifying Bridge API
1. Update `HiyoriBridge` interface definition
2. Implement new methods in `setupJavaScriptBridge()`
3. Add corresponding message handlers
4. Update React Native side to handle new messages

### Performance Optimization
1. Monitor `performanceMetrics` for initialization times
2. Use browser developer tools for runtime profiling
3. Test on actual mobile devices for real-world performance
4. Optimize PIXI application settings as needed

### Debugging Issues
1. Check browser console for detailed logs
2. Verify React Native logs for communication issues
3. Use debug status panel for visual state confirmation
4. Test network connectivity between devices

The character project is currently in a production-ready state with full Live2D integration, robust React Native communication, and comprehensive debugging support.
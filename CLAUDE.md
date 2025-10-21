# CLAUDE.md - Video Chat Project

This file provides guidance to Claude Code (claude.ai/code) when working with the multi-project video-chat repository.

## Repository Overview

The **Video Chat** repository contains a multi-project ecosystem for Live2D character interaction and video chat functionality. It demonstrates the integration between React Native mobile applications and web-based Live2D character displays.

### Current Development Status: 🚀 **Production-Ready Multi-Modal AI Companion**

- **Multi-Project Architecture**: ✅ Complete with EmoMate + Character integration
- **Voice Conversation System**: ✅ Claude AI + ElevenLabs TTS + Speech Recognition
- **Emotion Detection System**: ✅ MLKit face detection + text analysis (5 emotions)
- **Live2D Character System**: ✅ Full Hiyori VTuber model support (11 motions)
- **React Native WebView Bridge**: ✅ Bi-directional communication
- **Cross-Platform Compatibility**: ✅ Mobile and web integration
- **Overall Completion**: ✅ 85% - Beta ready for production deployment

## Project Structure

```
video-chat/
├── EmoMate/                    # React Native mobile application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx      # Navigation with Hiyori test entry
│   │   │   └── HiyoriWebView.tsx # WebView wrapper for character
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx  # Main screen with navigation
│   │   │   └── HiyoriScreen.tsx # Hiyori interaction interface
│   │   └── types/              # TypeScript definitions
│   ├── App.tsx                 # Root navigation setup
│   └── package.json            # React Native dependencies
├── character/                  # Web application for Live2D display
│   ├── app/
│   │   ├── components/
│   │   │   └── HiyoriLive2D.tsx # Main Live2D component
│   │   ├── routes/
│   │   │   └── _index.tsx      # Character display route
│   │   └── types/
│   │       └── live2d.d.ts     # Live2D type definitions
│   ├── public/assets/live2d/   # Hiyori model files
│   ├── vite.config.ts          # Network configuration
│   ├── CLAUDE.md               # Character project documentation
│   └── package.json            # Web app dependencies
└── CLAUDE.md                   # This file - multi-project overview
```

## Multi-Project Architecture

### EmoMate (React Native Mobile App)

**Purpose**: Mobile application providing user interface for Live2D character interaction

**Key Features**:

- React Native with Expo framework
- WebView integration for character display
- Navigation system with Hiyori test entry
- Motion control interface with 11+ animation types
- Real-time communication with character web app

**Technology Stack**:

- React Native with Expo
- TypeScript for type safety
- React Navigation for routing
- WebView for embedding character app
- Custom bridge for WebView communication

### Character (Web Application)

**Purpose**: Web-based Live2D character display optimized for WebView embedding

**Key Features**:

- Remix-based web application
- PIXI.js powered Live2D rendering
- JavaScript Bridge for external control
- Multi-stage initialization system
- Comprehensive debugging and monitoring

**Technology Stack**:

- Remix 2.16.8 with React 18
- PIXI.js 7.4.3 for WebGL rendering
- pixi-live2d-display-mulmotion for Live2D
- TypeScript in strict mode
- Vite 6.0.0 for development and building

## Inter-Project Communication

### Communication Flow

1. **Initialization Sequence**:
   ```
   EmoMate App Start → Navigation to Hiyori → WebView Load → Character App Load → 
   Live2D Model Load → Bridge Setup → Ready State → Motion Control Available
   ```

2. **Runtime Communication**:
   ```
   User Action (EmoMate) → WebView Bridge → JavaScript Injection → 
   HiyoriBridge.playMotion() → Live2D Animation → Result Callback → UI Update
   ```

### Message Protocol

All inter-project communication uses structured JSON messages:

```typescript
interface BridgeMessage {
  id: string;           // Unique message identifier
  type: string;         // Message type (motionResult, heartbeat, etc.)
  timestamp: number;    // Unix timestamp
  data?: any;          // Message payload
  error?: string;      // Error information if applicable
}
```

### Supported Message Types

- `domReady`: Character app DOM initialization complete
- `readinessUpdate`: Incremental initialization status updates
- `modelReady`: Full Live2D system ready for interaction
- `heartbeat`: Periodic connection health check (every 5s)
- `motionResult`: Animation execution result with success/error status
- `userInteraction`: User click/touch events on character
- `initError`: Initialization or runtime errors
- `cleanup`: Component cleanup notifications

## Network Configuration

### Development Setup

**Character Server Configuration**:
```typescript
// character/vite.config.ts
server: {
  host: '0.0.0.0',    // Listen on all network interfaces
  port: 5174,         // Development port (changed from 5173)
}
```

**WebView Connection**:
```typescript
// EmoMate/src/components/HiyoriWebView.tsx
source={{ uri: 'http://192.168.31.28:5174/' }}  // Local network IP
```

**Network Requirements**:

- Character server must bind to `0.0.0.0` for mobile device access
- Mobile device and development machine on same network
- CORS enabled for cross-origin requests
- Port 5174 open for development traffic

## Integration Features

### Live2D Character System

**Hiyori VTuber Model**:

- 11 predefined motion types (Happy, Wave, Dance, Shy, etc.)
- Interactive click/touch response system
- Automatic part visibility management (arm fixes)
- Performance-optimized rendering at 60fps
- Real-time parameter control capability

**Animation Control**:

- Motion queuing and execution system
- Error handling for failed animations
- Motion result reporting to mobile app
- Random motion selection for interactions

### React Native Integration

**WebView Bridge System**:

- JavaScript injection for command execution
- Message queue for pending commands
- Timeout and retry mechanisms
- Comprehensive error reporting
- Real-time status monitoring

**User Interface**:

- Motion control buttons with visual feedback
- Status indicators for connection health
- Debug information in development mode
- Graceful error handling and recovery

## Development Workflow

### Starting Development Environment

1. **Character Web App**:
   ```bash
   cd character
   npm install
   npm run dev  # Starts on http://192.168.31.28:5174/
   ```

2. **EmoMate Mobile App**:
   ```bash
   cd EmoMate
   npm install
   npx expo start  # Scan QR code with Expo Go
   ```

### Testing Integration

1. **Local Browser Testing**: Access `http://localhost:5174/` for character app
2. **Mobile Device Testing**: Use network IP for WebView integration
3. **Bridge Communication**: Monitor browser console and React Native logs
4. **Animation Testing**: Use motion control buttons in EmoMate app

### Debugging Multi-Project Issues

**Common Integration Problems**:

- Network connectivity between mobile and development server
- WebView JavaScript injection timing issues
- Live2D model loading failures
- Bridge communication protocol mismatches

**Debugging Steps**:

1. Check character server accessibility from mobile device
2. Verify WebView console logs for JavaScript errors
3. Monitor React Native logs for bridge communication
4. Use debug status panels for initialization tracking

## Project Dependencies

### EmoMate Dependencies

- React Native with Expo SDK
- react-native-webview for character embedding
- @react-navigation for app navigation
- TypeScript for type safety

### Character Dependencies

- Remix framework for web application structure
- PIXI.js for WebGL rendering engine
- pixi-live2d-display-mulmotion for Live2D support
- Vite for fast development and building

## Performance Considerations

### Optimization Strategies

- **Lazy Loading**: Character app loads only when needed
- **Resource Management**: Proper cleanup of PIXI resources
- **Memory Efficiency**: Optimized Live2D model settings
- **Network Efficiency**: Minimal data transfer for commands

### Performance Metrics

- DOM Load Time: < 100ms
- Live2D Core Load Time: < 500ms
- Model Load Time: < 2000ms
- Total Initialization: < 3000ms
- Animation Response: < 100ms

## Error Handling

### Cross-Project Error Types

1. **Network Errors**: Connection failures between projects
2. **Initialization Errors**: Live2D or WebView setup failures
3. **Runtime Errors**: Motion execution or bridge communication issues
4. **Resource Errors**: Model loading or asset access problems

### Error Recovery Mechanisms

- **Automatic Retry**: Failed connections retry up to 3 times
- **Graceful Degradation**: Error UI with manual retry options
- **Status Reporting**: Detailed error messages for debugging
- **Cleanup Procedures**: Proper resource disposal on errors

## Recent Achievements

### Multi-Modal AI Companion Features

- **Voice Conversation System**: ✅ Complete Claude AI integration with proactive dialogue (410 lines)
- **Emotion Detection**: ✅ MLKit-based facial emotion recognition (5 emotions, 60fps)
- **Live2D Integration**: ✅ Full Hiyori model with 11 motion types + emotion mapping
- **Text-to-Speech**: ✅ Hybrid ElevenLabs + Expo Speech with emotion-aware synthesis
- **Speech Recognition**: ✅ Real-time voice-to-text with Chinese/English support
- **Personality System**: ✅ Complete 兰兰 (LanLan) character with behavioral patterns
- **Emotion Analysis**: ✅ Multi-source emotion fusion (text + facial expression)

### Multi-Project Integration Milestones

- **Complete WebView Bridge**: Bi-directional communication system
- **Live2D Integration**: Full Hiyori model with 11 motion types
- **Network Configuration**: Mobile-friendly development setup
- **Error Handling**: Comprehensive error recovery system
- **Performance Optimization**: 60fps character rendering
- **Documentation**: Complete project memory system (7+ documents)

### Technical Improvements

- **TypeScript Integration**: Full type safety across projects (100% coverage)
- **Modern Build Systems**: Expo 53 + Vite 6.0 for optimal development
- **Cross-Platform Support**: iOS and Android compatibility
- **Debug Infrastructure**: Comprehensive logging and monitoring
- **State Management**: Zustand + Immer for clean immutable updates
- **AI Capabilities**: Claude 3 Haiku/Sonnet with dynamic token configuration

## Integration Status

### EmoMate Core Systems: ✅ **Production-Ready (85% Complete)**

**Completed Features**:
- ✅ Voice conversation system (Claude AI + proactive dialogue)
- ✅ Emotion detection system (MLKit face detection, 5 emotions)
- ✅ Live2D animation system (11 motions + emotion mapping)
- ✅ Speech synthesis (ElevenLabs + Expo fallback)
- ✅ Speech recognition (real-time voice-to-text)
- ✅ Personality system (兰兰 character)
- ✅ Emotion analysis (text + facial expression fusion)

**In Development**:
- ⏳ Environment awareness (light, noise, weather detection)
- ⏳ Motion recognition (gesture, movement detection)
- ⏳ Performance optimization (long conversation memory management)

### EmoMate ↔ Character Integration: ✅ **Fully Functional**

- React Native WebView successfully embeds character app
- Motion commands execute reliably with visual feedback
- Emotion-to-motion automatic mapping working smoothly
- Status monitoring provides real-time connection health
- Error handling ensures graceful failure recovery
- Performance meets mobile application standards (60fps)

### Communication Protocol: ✅ **Stable and Tested**

- Message format standardized and documented
- Bi-directional communication working reliably
- Error recovery mechanisms prevent communication breakdowns
- Heartbeat system maintains persistent connection health (5s intervals)
- Emotion data seamlessly transmitted to Live2D system

## Development Guidelines

### Adding New Projects

1. Create project directory in video-chat root
2. Add project-specific CLAUDE.md documentation
3. Update this main CLAUDE.md with integration details
4. Configure network settings for multi-project communication

### Modifying Inter-Project Communication

1. Update message protocol interfaces in both projects
2. Implement new message handlers in WebView bridge
3. Test communication flow between projects
4. Update documentation with new message types

### Performance Optimization

1. Monitor initialization metrics across projects
2. Profile WebView bridge communication overhead
3. Optimize Live2D rendering for mobile devices
4. Test network performance on various connection types

### Debugging Multi-Project Issues

1. Use browser developer tools for character app debugging
2. Monitor React Native logs for mobile app issues
3. Check network connectivity between projects
4. Verify message protocol compatibility between versions

## Project Documentation

### Core Documentation Files
- **PROGRESS.md**: Comprehensive project progress report with completion status and roadmap
- **PROJECT_EXPLORATION_REPORT.md**: Detailed exploration of all project components (20 KB)
- **QUICK_REFERENCE.md**: Fast reference guide for development (6.3 KB)
- **CLAUDE.md**: This file - multi-project overview and architecture
- **EmoMate/CLAUDE.md**: Detailed EmoMate implementation guide
- **EmoMate/docs/**: Feature-specific documentation (7 documents)

### Key Files Quick Reference
- **Voice System**: `EmoMate/src/utils/useChatAI.ts` (410 lines)
- **Emotion Detection**: `EmoMate/src/components/BasicEmotionDetector.tsx` (17 KB)
- **Live2D Integration**: `EmoMate/src/components/HiyoriWebView.tsx` (21 KB)
- **Personality**: `EmoMate/src/constants/personality.ts` (80+ lines)
- **Emotion Analysis**: `EmoMate/src/utils/emotionAnalysis.ts` (114 lines)

## Next Steps

### Immediate Priorities (2-3 weeks)
1. **Environment Awareness System**: Light, noise, weather detection
2. **Motion Recognition System**: Gesture and movement detection
3. **Performance Optimization**: Long conversation memory management
4. **Network Stability**: Enhanced reconnection mechanisms

### Medium-term Goals (4-8 weeks)
1. **Testing Framework**: Jest + React Native Testing Library (60%+ coverage)
2. **More Emotions**: Expand from 5 to 10+ emotion types
3. **More Motions**: Expand from 11 to 20+ Live2D animations
4. **Multi-language Support**: English and Japanese

### Long-term Vision
1. **Social Features**: Conversation sharing, community
2. **Personalization**: Character customization, learning preferences
3. **Gamification**: Affection system, achievements, daily tasks
4. **Advanced AI**: Context memory, personality evolution

## Summary

The video-chat repository demonstrates a successful **multi-modal AI companion application** with:
- **Voice conversation** (Claude AI with proactive dialogue)
- **Emotion detection** (facial expression + text analysis)
- **Live2D character animation** (emotion-responsive interactions)
- **Multi-project architecture** for Live2D character interaction
- **Robust communication protocols** across React Native and web boundaries
- **85% completion** with production-ready core features

**Current Status**: Beta-ready for production deployment with core multi-modal features complete.
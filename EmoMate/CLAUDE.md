# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EmoMate is a React Native mobile application built with Expo that serves as an emotional companion AI chat application. The app focuses on video-based interactions with AI companions, requiring camera and microphone permissions for real-time emotional analysis and conversation.

## Development Commands

```bash
# Start development server
npm start

# Run on specific platforms
npm run android
npm run ios  
npm run web

# Install dependencies
npm install
npx expo install <package-name>  # For Expo-compatible packages
```

Note: No testing or linting commands are currently configured in the project.

## Architecture Overview

### Tech Stack
- **Expo SDK 53** with React Native 0.79.5 and React 19.0.0
- **TypeScript** in strict mode for type safety
- **Zustand + Immer** for state management with immutable updates
- **React Navigation v7** for stack-based navigation
- **Expo Camera & Audio** for video/audio functionality

### State Management Pattern
The app uses Zustand with Immer middleware for clean, immutable state updates:
- `src/store/userStore.ts` - Central user state including AI character selection and emotion logs
- State is organized with typed interfaces and action creators
- Immer enables clean mutations that are safely immutable

### Permission Management
The app implements a permission-first design:
- Camera and microphone permissions are requested on app launch
- `src/utils/permissions.ts` provides centralized permission utilities
- UI gracefully handles permission denied states with user guidance

### Navigation Structure
- Stack navigator with TypeScript-typed route parameters
- Initial flow: WelcomeScreen → HomeScreen
- Navigation types defined in `App.tsx` and imported across screens

## Key Files and Patterns

### Project Structure
```
src/
├── screens/     # Screen components (WelcomeScreen, HomeScreen)
├── components/  # Reusable UI components (currently empty)
├── store/       # Zustand state management
├── utils/       # Utility functions (permissions, etc.)
└── constants/   # App constants (colors, sizes)
```

### TypeScript Patterns
- All files use TypeScript with proper interfaces
- Navigation params are strictly typed
- State interfaces are defined alongside store implementations
- Barrel exports (`index.ts`) for clean imports

### UI/UX Patterns
- Responsive design using centralized constants
- Mixed Chinese/English interface (ready for i18n)
- Permission-aware UI that adapts based on user permissions
- Modern React patterns with hooks and functional components

## Development Workflow

### Expo Managed Workflow
- Uses Expo managed workflow for simplified development
- `app.json` configures app metadata and permissions
- Hot reload enabled for fast iteration
- Cross-platform support (iOS, Android, Web)

### State Management Workflow
- Use `useUserStore` hook to access global state
- Actions are defined within the store for consistency
- Immer enables readable state updates without mutation

### Permission Workflow
- Check permissions on app launch
- Request permissions progressively based on user actions
- Provide clear feedback when permissions are denied
- Guide users to settings when manual permission changes are needed

## Current Implementation Status

### Completed Features
- Basic navigation structure with typed routes
- Camera and microphone permission handling
- Global state management setup
- Welcome and Home screen implementations
- UI component foundation with design system

### Architecture Ready For
- AI character selection and management
- Video chat implementation with camera/microphone
- Emotion analysis and logging
- Chat history and conversation management
- User preference persistence

### Missing Infrastructure
- Testing framework (Jest/React Native Testing Library)
- Linting and code formatting (ESLint/Prettier)
- Build scripts and CI/CD configuration
- Error boundary implementation
- Performance monitoring setup

The codebase follows modern React Native best practices and is well-structured for scaling into a full-featured emotional AI companion application.
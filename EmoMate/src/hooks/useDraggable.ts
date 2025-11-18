/**
 * Draggable hook
 * Provides pan gesture handling for draggable components
 */

import { useState, useMemo } from 'react';
import { PanResponder } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { constrainPosition, Position } from '../utils/cameraUtils';
import { CAMERA_CONSTANTS, ANIMATION_CONSTANTS } from '../constants/vision';
import { debugLog } from '../utils/debug';

/**
 * Draggable hook options
 */
export interface UseDraggableOptions {
  /** Initial position */
  initialPosition?: Position;
  /** Container width */
  containerWidth?: number;
  /** Container height */
  containerHeight?: number;
  /** Callback when position changes */
  onPositionChange?: (position: Position) => void;
}

/**
 * Draggable hook return value
 */
export interface UseDraggableReturn {
  /** Current position */
  position: Position;
  /** Pan responder handlers */
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  /** Animated style for the container */
  animatedStyle: {
    transform: { scale: number }[];
  };
}

/**
 * Hook for making components draggable
 *
 * Features:
 * - Pan gesture handling
 * - Boundary constraints
 * - Spring animations
 * - Position tracking
 *
 * @param options - Draggable configuration
 * @returns Draggable state and handlers
 */
export function useDraggable(
  options: UseDraggableOptions = {}
): UseDraggableReturn {
  const {
    initialPosition = { x: 20, y: 80 },
    containerWidth = CAMERA_CONSTANTS.CONTAINER_WIDTH,
    containerHeight = CAMERA_CONSTANTS.CONTAINER_HEIGHT,
    onPositionChange,
  } = options;

  const [position, setPosition] = useState<Position>(initialPosition);
  const scale = useSharedValue<number>(ANIMATION_CONSTANTS.NORMAL_SCALE);

  // Create PanResponder for drag handling
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          // Scale down when pressed
          scale.value = withSpring(ANIMATION_CONSTANTS.PRESSED_SCALE);
        },
        onPanResponderMove: (_evt, gestureState) => {
          // Update position during drag
          const newPosition = constrainPosition(
            position.x + gestureState.dx,
            position.y + gestureState.dy,
            containerWidth,
            containerHeight,
            CAMERA_CONSTANTS.SCREEN_WIDTH,
            CAMERA_CONSTANTS.SCREEN_HEIGHT
          );
          setPosition(newPosition);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          // Scale back to normal
          scale.value = withSpring(ANIMATION_CONSTANTS.NORMAL_SCALE);

          // Constrain final position
          const finalPosition = constrainPosition(
            position.x + gestureState.dx,
            position.y + gestureState.dy,
            containerWidth,
            containerHeight,
            CAMERA_CONSTANTS.SCREEN_WIDTH,
            CAMERA_CONSTANTS.SCREEN_HEIGHT
          );

          setPosition(finalPosition);
          onPositionChange?.(finalPosition);

          debugLog(
            'useDraggable',
            `Dragged to position: ${finalPosition.x}, ${finalPosition.y}`
          );
        },
      }),
    [position, containerWidth, containerHeight, scale, onPositionChange]
  );

  // Animated style for scale
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return {
    position,
    panHandlers: panResponder.panHandlers,
    animatedStyle,
  };
}

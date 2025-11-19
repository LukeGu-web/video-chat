/**
 * Simple Draggable Hook
 * Lightweight draggable implementation for debug panels
 */

import { useState, useRef, useMemo } from 'react';
import { PanResponder, Animated } from 'react-native';
import { debugLog } from '../utils/debug';

export interface UseSimpleDraggableOptions {
  /** Initial X position */
  initialX?: number;
  /** Initial Y position */
  initialY?: number;
  /** Callback when dragging starts */
  onDragStart?: () => void;
  /** Callback when dragging ends */
  onDragEnd?: (x: number, y: number) => void;
}

export interface UseSimpleDraggableReturn {
  /** Animated position value */
  pan: Animated.ValueXY;
  /** Pan responder handlers */
  panHandlers: any;
  /** Is currently dragging */
  isDragging: boolean;
  /** Animated style for the component */
  animatedStyle: {
    transform: { translateX: Animated.Value; translateY: Animated.Value }[];
  };
}

/**
 * Simple draggable hook for debug panels
 * Uses React Native's Animated API for smooth dragging
 */
export function useSimpleDraggable(
  options: UseSimpleDraggableOptions = {}
): UseSimpleDraggableReturn {
  const {
    initialX = 0,
    initialY = 0,
    onDragStart,
    onDragEnd,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setIsDragging(true);
          onDragStart?.();
          pan.setOffset({
            x: (pan.x as any)._value,
            y: (pan.y as any)._value,
          });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => {
          setIsDragging(false);
          pan.flattenOffset();

          const currentX = (pan.x as any)._value;
          const currentY = (pan.y as any)._value;

          onDragEnd?.(currentX, currentY);

          debugLog(
            'useSimpleDraggable',
            `Dragged to position: (${Math.round(currentX)}, ${Math.round(currentY)})`
          );
        },
      }),
    [pan, onDragStart, onDragEnd]
  );

  const animatedStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
    ],
  };

  return {
    pan,
    panHandlers: panResponder.panHandlers,
    isDragging,
    animatedStyle,
  };
}

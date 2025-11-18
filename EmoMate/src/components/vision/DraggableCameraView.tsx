/**
 * Draggable Camera View Component
 * Container component that makes its children draggable
 */

import React from 'react';
import Animated from 'react-native-reanimated';
import { useDraggable } from '../../hooks/ui';
import type { Position } from '../../utils/vision/cameraUtils';

/**
 * Draggable camera view props
 */
export interface DraggableCameraViewProps {
  /** Child components to render */
  children: React.ReactNode;
  /** Initial position */
  initialPosition?: Position;
  /** Container width */
  containerWidth?: number;
  /** Container height */
  containerHeight?: number;
  /** Callback when position changes */
  onPositionChange?: (position: Position) => void;
  /** Additional className for styling */
  className?: string;
}

/**
 * Draggable Camera View Component
 * Makes its children draggable with boundary constraints and animations
 *
 * Features:
 * - Drag gesture handling
 * - Boundary constraints
 * - Press/release animations
 * - Position tracking
 *
 * @param props - Component props
 */
export const DraggableCameraView: React.FC<DraggableCameraViewProps> = ({
  children,
  initialPosition,
  containerWidth,
  containerHeight,
  onPositionChange,
  className = '',
}) => {
  const { position, panHandlers, animatedStyle } = useDraggable({
    initialPosition,
    containerWidth,
    containerHeight,
    onPositionChange,
  });

  return (
    <Animated.View
      className={`absolute z-[1000] rounded-xl overflow-hidden bg-[#f8f9fa] border-2 border-[#e9ecef] shadow-md ${className}`}
      style={[
        {
          left: position.x,
          top: position.y,
          width: containerWidth,
          height: containerHeight,
        },
        animatedStyle,
      ]}
      {...panHandlers}
    >
      {children}
    </Animated.View>
  );
};

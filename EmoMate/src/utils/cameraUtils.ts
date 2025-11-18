/**
 * Camera utility functions
 * Common helpers for camera-related operations
 */

/**
 * Position interface
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Constrain position within screen boundaries
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param containerWidth - Width of the draggable container
 * @param containerHeight - Height of the draggable container
 * @param screenWidth - Screen width
 * @param screenHeight - Screen height
 * @returns Constrained position
 */
export function constrainPosition(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number,
  screenWidth: number,
  screenHeight: number
): Position {
  return {
    x: Math.max(0, Math.min(screenWidth - containerWidth, x)),
    y: Math.max(0, Math.min(screenHeight - containerHeight, y)),
  };
}

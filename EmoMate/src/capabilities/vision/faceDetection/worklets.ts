/**
 * Worklet utility functions for face detection
 * These functions can be executed in the worklet context (frame processor)
 */

/**
 * Point interface for landmarks
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Calculate Euclidean distance between two points
 * Worklet function - can be called in frame processor
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance between points
 */
export const calculateDistance = (p1: Point | null | undefined, p2: Point | null | undefined): number => {
  'worklet';
  if (!p1 || !p2) return 0;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate the midpoint between two points
 * Worklet function - can be called in frame processor
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Midpoint
 */
export const calculateMidpoint = (p1: Point, p2: Point): Point => {
  'worklet';
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
};

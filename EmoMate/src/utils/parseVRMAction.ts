export interface VRMActionPayload {
  blendShapes?: Record<string, number>;
  bones?: Record<string, { x?: number; y?: number; z?: number }>;
  duration?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface ParseActionResult {
  action: VRMActionPayload | null;
  cleanText: string;
  hasPartialTag: boolean;
}

const BLEND_SHAPE_BOUNDS: Record<string, [number, number]> = {
  joy: [0, 1], angry: [0, 1], sorrow: [0, 1],
  fun: [0, 1], surprised: [0, 1], neutral: [0, 1],
};

const BONE_BOUNDS: Record<string, Partial<Record<'x' | 'y' | 'z', [number, number]>>> = {
  head:          { x: [-0.35, 0.35], y: [-0.45, 0.45], z: [-0.35, 0.35] },
  neck:          { x: [-0.25, 0.25], y: [-0.35, 0.35], z: [-0.25, 0.25] },
  spine:         { x: [-0.25, 0.25], z: [-0.15, 0.15] },
  rightUpperArm: { x: [-1.6, 0.3],  z: [-1.3, 0.3] },
  rightLowerArm: { x: [0, 1.6] },
  leftUpperArm:  { x: [-1.6, 0.3],  z: [-0.3, 1.3] },
  leftLowerArm:  { x: [0, 1.6] },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizePayload(raw: unknown): VRMActionPayload {
  if (typeof raw !== 'object' || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const result: VRMActionPayload = {};

  if (r.blendShapes && typeof r.blendShapes === 'object') {
    result.blendShapes = {};
    for (const [key, val] of Object.entries(r.blendShapes as Record<string, unknown>)) {
      if (typeof val === 'number' && BLEND_SHAPE_BOUNDS[key]) {
        const [mn, mx] = BLEND_SHAPE_BOUNDS[key];
        result.blendShapes[key] = clamp(val, mn, mx);
      }
    }
  }

  if (r.bones && typeof r.bones === 'object') {
    result.bones = {};
    for (const [boneName, rotRaw] of Object.entries(r.bones as Record<string, unknown>)) {
      if (typeof rotRaw !== 'object' || rotRaw === null) continue;
      const rot = rotRaw as Record<string, unknown>;
      const bounds = BONE_BOUNDS[boneName];
      if (!bounds) continue;
      const boneResult: { x?: number; y?: number; z?: number } = {};
      for (const axis of ['x', 'y', 'z'] as const) {
        if (typeof rot[axis] === 'number' && bounds[axis]) {
          const [mn, mx] = bounds[axis]!;
          boneResult[axis] = clamp(rot[axis] as number, mn, mx);
        }
      }
      result.bones[boneName] = boneResult;
    }
  }

  if (typeof r.duration === 'number') {
    result.duration = clamp(r.duration, 0.2, 5.0);
  }

  const VALID_EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const;
  if (typeof r.easing === 'string' && (VALID_EASINGS as readonly string[]).includes(r.easing)) {
    result.easing = r.easing as VRMActionPayload['easing'];
  }

  return result;
}

/**
 * Processes a raw text buffer (may be partial streaming output).
 *
 * - Extracts and sanitizes complete <action>...</action> blocks.
 * - Returns cleanText with ALL complete action blocks removed.
 * - Sets hasPartialTag=true when an unclosed <action> is at the end.
 */
export function parseVRMAction(text: string): ParseActionResult {
  let cleanText = text;
  let action: VRMActionPayload | null = null;

  const completeRegex = /<action>([\s\S]*?)<\/action>/g;
  let match: RegExpExecArray | null;
  while ((match = completeRegex.exec(text)) !== null) {
    try {
      action = sanitizePayload(JSON.parse(match[1].trim()));
    } catch {
      // invalid JSON — discard action but still strip tag
    }
  }
  cleanText = text.replace(/<action>[\s\S]*?<\/action>/g, '').trim();

  const partialStart = cleanText.lastIndexOf('<action>');
  let hasPartialTag = false;
  if (partialStart !== -1) {
    hasPartialTag = true;
    cleanText = cleanText.slice(0, partialStart).trim();
  }

  return { action, cleanText, hasPartialTag };
}

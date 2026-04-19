# VRM Phase 4 — AI-Driven Parameter Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude generates VRM animation parameters inside `<action>` tags alongside its conversational response. EmoMate strips the tags during streaming (before TTS), dispatches the pose via the existing `lipSyncBridge`, and the character performs the pose then auto-returns to idle.

**Architecture:** (1) `VRM_PARAMETER_MANUAL` constant teaches Claude the available blend shapes/bones. (2) `parseVRMAction.ts` utility extracts+sanitizes `<action>` JSON. (3) `useChatAI.ts` maintains a `rawBuffer` to handle cross-chunk `<action>` tags; clean text goes to TTS and display. (4) `lipSyncBridge.sendVRMCommand({ type: 'playPose', data })` dispatches the action — no new bridge needed. (5) `ExpressionController` adds bone clamping + auto-return-to-idle after pose duration.

**Tech Stack:** Claude streaming SSE, TypeScript, existing `lipSyncBridge`, `@pixiv/three-vrm` expression manager

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Create | `EmoMate/src/constants/vrmSchema.ts` | VRM parameter manual string |
| Modify | `EmoMate/src/hooks/ai/buildAIContext.ts` | Inject manual as non-cached system block |
| Create | `EmoMate/src/utils/parseVRMAction.ts` | Extract + sanitize `<action>` from text |
| Modify | `EmoMate/src/hooks/useChatAI.ts` | rawBuffer approach; strip tags before TTS |
| Modify | `character/app/components/ExpressionController.tsx` | Bone clamping + auto-return-to-idle |

---

## Task 1: VRM Parameter Manual Constant

**Files:**
- Create: `EmoMate/src/constants/vrmSchema.ts`

- [ ] **Step 1: Create the file**

```typescript
// EmoMate/src/constants/vrmSchema.ts

export const VRM_PARAMETER_MANUAL = `
## 角色动作控制

你在回复时，可以在 <action> 标签内附加动作指令，控制兰兰的表情和肢体动作。每条回复最多附加一个 <action> 标签。

### 可用表情（blendShapes，值范围 0.0~1.0）
- joy: 开心、高兴
- sorrow: 难过、悲伤
- angry: 生气、不满
- surprised: 惊讶、震惊
- fun: 俏皮、调侃、开心玩闹
- neutral: 回到平静状态（将所有表情归零时使用）

### 可用骨骼旋转（弧度）
- head: 头部（x: 点头下+/后仰-，范围±0.3; y: 向左转-/右转+，范围±0.4; z: 向左歪+/右歪-，范围±0.3）
- neck: 颈部（x: ±0.2; y: ±0.3; z: ±0.2）
- spine: 脊椎（x: 前倾+/后仰-，范围±0.2; z: 侧倾，范围±0.1）
- rightUpperArm: 右上臂（x: 向前举起为负值，范围 0~-1.5; z: 向侧面举起为负值，范围 0~-1.2）
- rightLowerArm: 右前臂（x: 向上弯曲为正值，范围 0~1.5）
- leftUpperArm: 左上臂（x: 向前举起为负值，范围 0~-1.5; z: 向侧面举起为正值，范围 0~1.2）
- leftLowerArm: 左前臂（x: 向上弯曲为正值，范围 0~1.5）

### 指令格式
<action>
{"blendShapes":{"joy":0.8},"bones":{"head":{"y":0.1}},"duration":1.5,"easing":"easeOut"}
</action>

duration 单位为秒（0.5~3.0）。easing 可选: "linear" / "easeIn" / "easeOut" / "easeInOut"。

### 使用原则
- 只在情绪明显时才附加动作（惊讶、开心、难过、思考中等）
- 普通问答不加动作
- 幅度要自然，head.y 不超过 0.35，spine.x 不超过 0.15
- 不需要动作时完全省略 <action> 标签
`.trim();
```

- [ ] **Step 2: Commit**

```bash
git add EmoMate/src/constants/vrmSchema.ts
git commit -m "feat: add VRM parameter manual for Claude system prompt"
```

---

## Task 2: Inject Manual into buildAIContext

**Files:**
- Modify: `EmoMate/src/hooks/ai/buildAIContext.ts`

- [ ] **Step 1: Add import**

At the top of `buildAIContext.ts`, add:

```typescript
import { VRM_PARAMETER_MANUAL } from '../../constants/vrmSchema';
```

- [ ] **Step 2: Add non-cached block inside `buildCacheableSystemPrompt`**

In `buildCacheableSystemPrompt`, find the section that pushes blocks onto `systemBlocks`. After the memory block (the last `if (memoryBlock)` push), add:

```typescript
  // Block: VRM parameter manual (not cached — updated frequently during development)
  systemBlocks.push({
    type: 'text',
    text: VRM_PARAMETER_MANUAL,
  });
```

- [ ] **Step 3: TypeScript check**

```bash
cd EmoMate && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add EmoMate/src/hooks/ai/buildAIContext.ts
git commit -m "feat: inject VRM parameter manual into Claude system prompt"
```

---

## Task 3: Create parseVRMAction Utility

**Files:**
- Create: `EmoMate/src/utils/parseVRMAction.ts`

- [ ] **Step 1: Create the file**

```typescript
// EmoMate/src/utils/parseVRMAction.ts

export interface VRMActionPayload {
  blendShapes?: Record<string, number>;
  bones?: Record<string, { x?: number; y?: number; z?: number }>;
  duration?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface ParseActionResult {
  // Parsed and sanitized action, or null if not found / invalid JSON
  action: VRMActionPayload | null;
  // Input text with ALL <action>...</action> blocks removed
  cleanText: string;
  // True if there is an unclosed <action> tag at the end (streaming in progress)
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
 * - Sets hasPartialTag=true when an unclosed <action> is at the end
 *   (caller should withhold the tail from display until tag closes).
 */
export function parseVRMAction(text: string): ParseActionResult {
  let cleanText = text;
  let action: VRMActionPayload | null = null;

  // Extract all complete action blocks (use last one if multiple)
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

  // Check for unclosed <action> tag at end
  const partialStart = cleanText.lastIndexOf('<action>');
  let hasPartialTag = false;
  if (partialStart !== -1) {
    hasPartialTag = true;
    cleanText = cleanText.slice(0, partialStart).trim();
  }

  return { action, cleanText, hasPartialTag };
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd EmoMate && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add EmoMate/src/utils/parseVRMAction.ts
git commit -m "feat: add parseVRMAction utility with bounds clamping"
```

---

## Task 4: Wire Action Parsing into Streaming (useChatAI)

**Files:**
- Modify: `EmoMate/src/hooks/useChatAI.ts`

The existing streaming loop accumulates text in `partialSentence` and calls `stripActionDescriptions` (strips `(括号)`) before `onSentence`. We need to also handle `<action>` tags. The key constraint: **`<action>` can span across sentence boundaries**, so we maintain a separate `rawBuffer` that accumulates all raw text.

- [ ] **Step 1: Add import**

Near the top of `useChatAI.ts`, add:

```typescript
import { parseVRMAction } from '../utils/parseVRMAction';
```

- [ ] **Step 2: Add `rawBuffer` variable in `callClaudeAPIStreaming`**

Inside `callClaudeAPIStreaming`, right after the existing declarations (`let fullText = ''`, `let processedLength = 0`, etc.), add:

```typescript
let rawBuffer = ''; // accumulates all raw text to detect cross-chunk <action> blocks
```

- [ ] **Step 3: Replace the text processing block in `xhr.onprogress`**

Find this block in `onprogress` (around line 248):

```typescript
if (text) {
  // DISABLED: SmartSentenceBuffer filtering
  // Now playing ALL sentences directly without filtering
  partialSentence += text;

  // Extract complete sentences
  let currentSentence = '';
  for (let i = 0; i < partialSentence.length; i++) {
```

Replace it with:

```typescript
if (text) {
  // Phase 4: Accumulate raw text to detect cross-chunk <action> blocks
  rawBuffer += text;

  // Extract complete <action> blocks from rawBuffer; dispatch to WebView
  const { action, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
  if (action) {
    lipSyncBridge.sendVRMCommand({ type: 'playPose', data: action });
    debugLog('ChatAI', 'Phase 4: AI action dispatched', action);
  }
  // cleanText has complete action blocks stripped; partial tag tail is also removed
  // Update rawBuffer to only the portion after complete actions (preserve partial tag if any)
  rawBuffer = hasPartialTag
    ? rawBuffer.slice(rawBuffer.lastIndexOf('<action>'))  // keep partial tag for next chunk
    : (action ? '' : rawBuffer.replace(/<action>[\s\S]*?<\/action>/g, ''));

  // Feed clean text into existing sentence detection
  const newClean = cleanText.slice(partialSentence.length); // only the NEW portion
  partialSentence += newClean.length > 0 ? newClean : cleanText.slice(partialSentence.length);
  // Simpler: rebuild partialSentence from cleanText minus what was already processed
  // Actually use cleanText directly as the new source of truth for the sentence buffer:
  partialSentence = cleanText;

  // Extract complete sentences
  let currentSentence = '';
  partialSentence = ''; // will be rebuilt below
  for (let i = 0; i < cleanText.length; i++) {
```

Wait — the above is getting tangled because `partialSentence` tracks UNFINISHED text across multiple chunks. The correct approach:

**Replace the entire `if (text) { ... }` block with:**

```typescript
if (text) {
  // Phase 4: pipe all raw text through rawBuffer to handle cross-chunk <action> blocks
  rawBuffer += text;

  // Extract complete <action> blocks and dispatch
  const { action, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
  if (action) {
    lipSyncBridge.sendVRMCommand({ type: 'playPose', data: action });
    debugLog('ChatAI', 'Phase 4: AI action dispatched', action);
  }

  // Update rawBuffer: remove everything that was cleanly processed.
  // If there's a partial tag at end, preserve from <action> onward for next chunk.
  rawBuffer = hasPartialTag
    ? rawBuffer.slice(rawBuffer.lastIndexOf('<action>'))
    : rawBuffer.replace(/<action>[\s\S]*?<\/action>/g, '');

  // Determine what's new in cleanText vs what partialSentence already has
  // partialSentence holds the in-progress (unfinished) sentence from prior chunks.
  // cleanText is the full clean accumulated text so far — we need only the NEW portion.
  const alreadySentLength = fullText.length;  // chars already fired via onSentence
  const newCleanChars = cleanText.slice(alreadySentLength + (partialSentence.length > 0 ? partialSentence.length : 0));
  partialSentence += newCleanChars;

  // Extract complete sentences from partialSentence
  let currentSentence = '';
  for (let i = 0; i < partialSentence.length; i++) {
    const char = partialSentence[i];
    currentSentence += char;

    if (sentenceEndings.includes(char)) {
      const sentence = stripActionDescriptions(currentSentence.trim());
      if (sentence) {
        debugLog('ChatAI', 'Playing complete sentence (unfiltered)', { sentence });
        onSentence(sentence);
        fullText += sentence;
      }
      currentSentence = '';
    }
  }

  // Update partial sentence with remaining incomplete text
  partialSentence = currentSentence;
}
```

> **Note to implementer:** The logic tracking "what's new" relative to prior chunks can be subtle. The safest implementation: replace `partialSentence += text` with `partialSentence += newClean` where `newClean` is the net-new characters from cleanText. Since `parseVRMAction` returns the ENTIRE accumulated cleanText (not a delta), compute `newClean = cleanText.slice(prevCleanLength)` where `prevCleanLength` is tracked separately.

**Concrete, simplified implementation of Step 3 — paste this in place of the `if (text) { ... }` block:**

```typescript
if (text) {
  rawBuffer += text;

  // Strip complete <action> blocks; dispatch last found action
  const { action, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
  if (action) {
    lipSyncBridge.sendVRMCommand({ type: 'playPose', data: action });
    debugLog('ChatAI', 'Phase 4: AI action dispatched', action);
  }

  // Keep only unprocessed raw text in rawBuffer
  rawBuffer = hasPartialTag
    ? rawBuffer.slice(rawBuffer.lastIndexOf('<action>'))
    : '';

  // The new clean characters to add to the sentence buffer
  // cleanText is everything processed so far (clean). partialSentence holds
  // the unfinished sentence. Compute delta from total already committed.
  const totalCommitted = fullText.length + partialSentence.length;
  const newChars = cleanText.slice(totalCommitted);
  partialSentence += newChars;

  // Extract complete sentences
  let currentSentence = '';
  for (let i = 0; i < partialSentence.length; i++) {
    const char = partialSentence[i];
    currentSentence += char;

    if (sentenceEndings.includes(char)) {
      const sentence = stripActionDescriptions(currentSentence.trim());
      if (sentence) {
        debugLog('ChatAI', 'Playing complete sentence (unfiltered)', { sentence });
        onSentence(sentence);
        fullText += sentence;
      }
      currentSentence = '';
    }
  }

  partialSentence = currentSentence;
}
```

- [ ] **Step 4: Update `xhr.onload` final flush**

In `xhr.onload`, find:

```typescript
if (partialSentence.trim()) {
  const finalSentence = stripActionDescriptions(partialSentence.trim());
```

Replace with:

```typescript
// Flush any remaining rawBuffer (action tag that never closed)
// Just discard — malformed tag
rawBuffer = '';

if (partialSentence.trim()) {
  const { cleanText: cleanFinal } = parseVRMAction(partialSentence.trim());
  const finalSentence = stripActionDescriptions(cleanFinal);
```

- [ ] **Step 5: TypeScript check**

```bash
cd EmoMate && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add EmoMate/src/hooks/useChatAI.ts
git commit -m "feat: parse VRM <action> tags during streaming, dispatch via lipSyncBridge"
```

---

## Task 5: Bone Clamping + Auto-Return-to-Idle in ExpressionController

**Files:**
- Modify: `character/app/components/ExpressionController.tsx`

The existing `playPose` handler (line 179) already applies blend shapes and bones, but doesn't clamp bone values and never restores idle after the pose finishes.

- [ ] **Step 1: Add `BONE_SAFE_RANGES` constant and `clampBone` helper at top of file**

After the `BONE_NAME_MAP` definition, add:

```typescript
const BONE_SAFE_RANGES: Record<string, Partial<Record<'x' | 'y' | 'z', [number, number]>>> = {
  head:          { x: [-0.35, 0.35], y: [-0.45, 0.45], z: [-0.35, 0.35] },
  neck:          { x: [-0.25, 0.25], y: [-0.35, 0.35], z: [-0.25, 0.25] },
  spine:         { x: [-0.25, 0.25], z: [-0.15, 0.15] },
  rightUpperArm: { x: [-1.6, 0.3],  z: [-1.3, 0.3] },
  rightLowerArm: { x: [0, 1.6] },
  leftUpperArm:  { x: [-1.6, 0.3],  z: [-0.3, 1.3] },
  leftLowerArm:  { x: [0, 1.6] },
};

function clampBone(boneName: string, rot: { x?: number; y?: number; z?: number }): { x?: number; y?: number; z?: number } {
  const ranges = BONE_SAFE_RANGES[boneName];
  if (!ranges) return rot;
  const result: { x?: number; y?: number; z?: number } = {};
  for (const axis of ['x', 'y', 'z'] as const) {
    if (rot[axis] === undefined) continue;
    const range = ranges[axis];
    result[axis] = range
      ? Math.max(range[0], Math.min(range[1], rot[axis]!))
      : rot[axis];
  }
  return result;
}
```

- [ ] **Step 2: Add `idleReturnTimer` ref**

Inside `ExpressionController`, alongside the other refs (`animState`, `presetState`, `blinkTimer`), add:

```typescript
const idleReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 3: Replace the `case 'playPose':` block**

Find (line ~179):

```typescript
        case 'playPose':
          if (cmd.data.blendShapes) {
            state.targetBlendShapes = cmd.data.blendShapes;
          }
          if (cmd.data.bones) {
            state.targetBones = cmd.data.bones;
          }
          state.transitionDuration = cmd.data.duration ?? 1.0;
          state.transitionElapsed = 0;
          state.easing = cmd.data.easing ?? 'easeInOut';
          state.isAnimating = true;
          presetState.current = { name: null, elapsed: 0, loop: false };
          break;
```

Replace with:

```typescript
        case 'playPose': {
          if (cmd.data.blendShapes) {
            state.targetBlendShapes = cmd.data.blendShapes;
          }
          if (cmd.data.bones) {
            // Clamp each bone's values to safe ranges
            const safeBones: BoneMap = {};
            for (const [boneName, rot] of Object.entries(cmd.data.bones as BoneMap)) {
              if (rot) safeBones[boneName as keyof BoneMap] = clampBone(boneName, rot) as any;
            }
            state.targetBones = safeBones;
          }
          const poseDuration = cmd.data.duration ?? 1.0;
          state.transitionDuration = poseDuration;
          state.transitionElapsed = 0;
          state.easing = cmd.data.easing ?? 'easeInOut';
          state.isAnimating = true;
          // Pause idle loop for this pose
          presetState.current = { name: null, elapsed: 0, loop: false };
          // Auto-return to idle after pose finishes
          if (idleReturnTimer.current) clearTimeout(idleReturnTimer.current);
          idleReturnTimer.current = setTimeout(() => {
            presetState.current = { name: 'idle', elapsed: 0, loop: true };
            idleReturnTimer.current = null;
          }, (poseDuration + 0.8) * 1000);
          break;
        }
```

- [ ] **Step 4: Clear timer on component unmount**

Inside the `useEffect(() => { ... window.addEventListener('message', handleMessage) ... }, [])` cleanup, add:

```typescript
    return () => {
      window.removeEventListener('message', handleMessage);
      if (idleReturnTimer.current) clearTimeout(idleReturnTimer.current);
    };
```

- [ ] **Step 5: TypeScript check**

```bash
cd character && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add character/app/components/ExpressionController.tsx
git commit -m "feat: bone clamping + auto-return-to-idle after AI playPose"
```

---

## Task 6: End-to-End Test

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1
cd character && npm run dev

# Terminal 2
cd EmoMate && npx expo start
```

- [ ] **Step 2: Browser console sanity test**

In the browser (character WebView), manually trigger a `playPose`:

```javascript
window.dispatchEvent(new MessageEvent('message', {
  data: JSON.stringify({
    type: 'playPose',
    data: {
      blendShapes: { surprised: 0.9 },
      bones: { head: { x: -0.1, y: 0.05 } },
      duration: 1.5,
      easing: 'easeOut'
    }
  })
}));
```

Expected: character looks surprised + slight head movement, then returns to idle after ~2.3 seconds.

- [ ] **Step 3: Test strong-emotion message**

Send from app: "哇，真的吗？！这太惊讶了！"

Expected: Claude responds with a `<action>` block containing `surprised`. Character does the expression. Chat bubble and TTS have NO `<action>` text.

- [ ] **Step 4: Test thinking message**

Send: "你觉得人工智能会取代人类吗？"

Expected: Claude uses `fun` or `sorrow` blend shapes, possibly tilts head. Character poses then auto-returns to idle.

- [ ] **Step 5: Test neutral message (no action)**

Send: "今天几号？"

Expected: Claude responds WITHOUT `<action>`. Character uses Phase 2 rule-based expressions as normal fallback.

- [ ] **Step 6: Verify no tag leaks**

Check chat bubble text — no `<action>` literal. Listen to TTS — "action" is never read aloud.

- [ ] **Step 7: Verify lip sync and AI action coexist**

While TTS is playing (mouth moving), the AI pose should also be active — they operate on different blend shapes and should not conflict.

- [ ] **Step 8: Final TypeScript check**

```bash
cd EmoMate && npx tsc --noEmit
cd character && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Phase 4 complete — AI-driven VRM animation via <action> tags"
```

---

## Verification Checklist (from spec)

- [ ] Claude response with `<action>` triggers correct VRM pose
- [ ] `<action>` absent from displayed chat messages
- [ ] `<action>` absent from TTS audio
- [ ] AI-generated bone values stay within safe ranges (no model deformation)
- [ ] Responses without `<action>` still use Phase 2 rule-based expressions as fallback
- [ ] Lip sync and AI pose work simultaneously without interference
- [ ] VRM returns to idle after pose duration expires
- [ ] 10-conversation test: actions appear in emotionally appropriate moments only
- [ ] `npx tsc --noEmit` passes in both projects

# VRM Phase 4 — AI-Driven Parameter Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude generates VRM animation parameters inside `<action>` tags alongside its conversational response. EmoMate parses these tags during streaming, strips them from displayed/spoken text, and sends the extracted pose commands to the WebView. The character performs natural, contextually appropriate one-off movements.

**Architecture:** (1) A `VRM_PARAMETER_MANUAL` constant in `buildAIContext.ts` teaches Claude the available blend shapes and bones. (2) A `parseVRMAction` utility extracts `<action>` JSON from streaming chunks as they arrive. (3) `useChatAI.ts` calls the parser and fires bridge commands on the WebView ref. (4) `ExpressionController` already handles `playPose` messages — add parameter clamping for safety.

**Tech Stack:** Claude streaming SSE, TypeScript, existing bridge protocol, `@pixiv/three-vrm` expression manager

---

## Task 1: Create VRM Parameter Manual Constant

**Files:**
- Create: `EmoMate/src/constants/vrmSchema.ts`

- [ ] **Step 1: Create the file**

```typescript
// EmoMate/src/constants/vrmSchema.ts

/**
 * VRM Parameter Manual injected into Claude's system prompt.
 * Teaches Claude which blend shapes and bones are available,
 * their value ranges, and when to use them.
 */
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

### 可用骨骼旋转（弧度，正值方向如下）
- head: 头部（x: 点头下+/后仰-，范围±0.3; y: 向左转-/右转+，范围±0.4; z: 向左歪+/右歪-，范围±0.3）
- neck: 颈部（x: ±0.2; y: ±0.3; z: ±0.2）
- spine: 脊椎（x: 前倾+/后仰-，范围±0.2; z: 侧倾，范围±0.1）
- rightUpperArm: 右上臂（x: 向前举起为负值，范围 0~-1.5; z: 向侧面举起为负值，范围 0~-1.2）
- rightLowerArm: 右前臂（x: 向上弯曲为正值，范围 0~1.5）
- leftUpperArm: 左上臂（x: 向前举起为负值，范围 0~-1.5; z: 向侧面举起为正值，范围 0~1.2）
- leftLowerArm: 左前臂（x: 向上弯曲为正值，范围 0~1.5）

### 指令格式
<action>
{
  "blendShapes": { "joy": 0.8 },
  "bones": { "head": { "y": 0.1 } },
  "duration": 1.5,
  "easing": "easeOut"
}
</action>

duration 单位为秒（0.5~3.0）。easing 可选: "linear" / "easeIn" / "easeOut" / "easeInOut"。

### 使用原则
- 只在情绪明显时才附加动作（惊讶、开心、难过、思考中等）
- 普通问答回复不需要加动作
- 幅度要自然，head.y 不要超过 0.35，spine.x 不要超过 0.15
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

- [ ] **Step 1: Import the manual and add it as a system block**

In `buildAIContext.ts`, find the function `buildCacheableAPIRequestConfig` (or equivalent that builds the messages array). Add the VRM manual as a non-cached system block:

```typescript
// Add import at top:
import { VRM_PARAMETER_MANUAL } from '../../constants/vrmSchema';

// Inside the function that builds system messages, after the main personality block,
// add a new non-cached block:
{
  type: 'text' as const,
  text: VRM_PARAMETER_MANUAL,
  // No cache_control here — we want it fresh every request so updates take effect
},
```

The system messages array should look like:
```typescript
const systemMessages = [
  // Block 1: personality (cached)
  { type: 'text', text: personalityPrompt, cache_control: { type: 'ephemeral' } },
  // Block 2: capability/scene context (may be cached)
  { type: 'text', text: contextPrompt, cache_control: { type: 'ephemeral' } },
  // Block 3: memory (not cached, changes each turn)
  { type: 'text', text: memoryBlock },
  // Block 4: VRM parameter manual (not cached) ← NEW
  { type: 'text', text: VRM_PARAMETER_MANUAL },
];
```

- [ ] **Step 2: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

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
  action: VRMActionPayload | null;
  cleanText: string;  // text with <action>...</action> removed
}

// Safe value bounds for blend shapes and bones
const BLEND_SHAPE_BOUNDS: Record<string, [number, number]> = {
  joy: [0, 1], angry: [0, 1], sorrow: [0, 1],
  fun: [0, 1], surprised: [0, 1], neutral: [0, 1],
};

const BONE_BOUNDS: Record<string, { x?: [number, number]; y?: [number, number]; z?: [number, number] }> = {
  head:          { x: [-0.35, 0.35], y: [-0.45, 0.45], z: [-0.35, 0.35] },
  neck:          { x: [-0.25, 0.25], y: [-0.35, 0.35], z: [-0.25, 0.25] },
  spine:         { x: [-0.25, 0.25], z: [-0.15, 0.15] },
  rightUpperArm: { x: [-1.6, 0.3], z: [-1.3, 0.3] },
  rightLowerArm: { x: [0, 1.6] },
  leftUpperArm:  { x: [-1.6, 0.3], z: [-0.3, 1.3] },
  leftLowerArm:  { x: [0, 1.6] },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizePayload(raw: any): VRMActionPayload {
  const result: VRMActionPayload = {};

  if (raw.blendShapes && typeof raw.blendShapes === 'object') {
    result.blendShapes = {};
    for (const [key, val] of Object.entries(raw.blendShapes)) {
      if (typeof val === 'number' && BLEND_SHAPE_BOUNDS[key]) {
        const [min, max] = BLEND_SHAPE_BOUNDS[key];
        result.blendShapes[key] = clamp(val, min, max);
      }
    }
  }

  if (raw.bones && typeof raw.bones === 'object') {
    result.bones = {};
    for (const [boneName, rotRaw] of Object.entries(raw.bones)) {
      const rot = rotRaw as any;
      const bounds = BONE_BOUNDS[boneName];
      if (!bounds || typeof rot !== 'object') continue;
      result.bones[boneName] = {};
      for (const axis of ['x', 'y', 'z'] as const) {
        if (typeof rot[axis] === 'number' && bounds[axis]) {
          const [min, max] = bounds[axis]!;
          result.bones[boneName]![axis] = clamp(rot[axis], min, max);
        }
      }
    }
  }

  if (typeof raw.duration === 'number') {
    result.duration = clamp(raw.duration, 0.2, 5.0);
  }

  const validEasings = ['linear', 'easeIn', 'easeOut', 'easeInOut'];
  if (typeof raw.easing === 'string' && validEasings.includes(raw.easing)) {
    result.easing = raw.easing as VRMActionPayload['easing'];
  }

  return result;
}

/**
 * Parses <action>...</action> from a text chunk.
 * Works on both partial (streaming) and complete text.
 * Returns the sanitized action payload and the text with the tag removed.
 */
export function parseVRMAction(text: string): ParseActionResult {
  const match = text.match(/<action>([\s\S]*?)<\/action>/);
  if (!match) {
    return { action: null, cleanText: text };
  }

  const cleanText = text.replace(/<action>[\s\S]*?<\/action>/g, '').trim();

  try {
    const raw = JSON.parse(match[1].trim());
    const action = sanitizePayload(raw);
    return { action, cleanText };
  } catch {
    // Invalid JSON inside <action> — strip tag but discard action
    return { action: null, cleanText };
  }
}

/**
 * Strips any <action>...</action> tags from text (for display/TTS use).
 * Safe to call even if no action tag is present.
 */
export function stripActionTag(text: string): string {
  return text.replace(/<action>[\s\S]*?<\/action>/g, '').trim();
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add EmoMate/src/utils/parseVRMAction.ts
git commit -m "feat: add parseVRMAction utility with bounds clamping"
```

---

## Task 4: Update useChatAI to Parse and Dispatch Actions

**Files:**
- Modify: `EmoMate/src/hooks/useChatAI.ts`

- [ ] **Step 1: Import parseVRMAction**

At the top of `useChatAI.ts`, add:

```typescript
import { parseVRMAction, stripActionTag } from '../utils/parseVRMAction';
```

- [ ] **Step 2: Find the streaming chunk accumulation**

In `useChatAI.ts`, find the section that handles streaming SSE chunks. It likely looks like:

```typescript
// Somewhere in the streaming loop:
fullText += chunk;
setCurrentSegment(chunk);
// ... passes chunk to TTS ...
```

- [ ] **Step 3: Parse action from accumulated full response**

After the streaming loop completes (when the full response is assembled), add action parsing:

```typescript
// After streaming is complete, parse action from the full response:
const { action, cleanText } = parseVRMAction(fullText);

if (action) {
  // Dispatch to WebView — webViewRef comes from component props or context
  // The exact ref access depends on your architecture
  webViewCommandRef.current?.({ type: 'playPose', data: action });
}

// Use cleanText (without <action> tags) for display and TTS:
const displayText = cleanText;
// ... use displayText instead of fullText for chat message and TTS ...
```

- [ ] **Step 4: Ensure stripActionTag is applied to TTS text**

Find where text is passed to `ttsQueue.enqueue()`. Wrap it:

```typescript
// Before enqueue, strip any action tags:
const ttsText = stripActionTag(sentenceChunk);
if (ttsText.trim()) {
  ttsQueue.enqueue(ttsText, options);
}
```

Note: The existing `stripActionDescriptions` from `fishAudioAPI` strips `(动作描述)` format. `stripActionTag` strips `<action>...</action>` format — both are needed now.

- [ ] **Step 5: Add webViewCommandRef**

Add a ref that holds the WebView send function, and expose a setter:

```typescript
// In useChatAI hook, add:
const webViewCommandRef = useRef<((cmd: { type: string; data?: any }) => void) | null>(null);

// Expose setter in return:
return {
  // ... existing returns ...
  setWebViewCommandFn: (fn: (cmd: { type: string; data?: any }) => void) => {
    webViewCommandRef.current = fn;
  },
};
```

- [ ] **Step 6: Wire it in HomeScreen or wherever useChatAI is used**

Find where `useChatAI` is called (likely `HomeScreen.tsx`). After `webViewRef` is available:

```typescript
const { setWebViewCommandFn, ...rest } = useChatAIWithLanLan();

// After HiyoriWebView mounts:
useEffect(() => {
  setWebViewCommandFn((cmd) => {
    webViewRef.current?.sendVRMCommand(cmd);
  });
}, []);
```

- [ ] **Step 7: TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8: Commit**

```bash
git add EmoMate/src/hooks/useChatAI.ts
git commit -m "feat: parse VRM action from Claude response, dispatch to WebView"
```

---

## Task 5: Add Parameter Clamping to ExpressionController

**Files:**
- Modify: `character/app/components/ExpressionController.tsx`

The `playPose` handler already works from Phase 2. This task adds safety clamping for AI-generated values.

- [ ] **Step 1: Add clamp helper and validate incoming playPose data**

In `ExpressionController.tsx`, find the `case 'playPose':` handler and add validation:

```typescript
// Add clamp helper at top of file:
function clampBoneVal(boneName: string, axis: 'x' | 'y' | 'z', value: number): number {
  const SAFE_RANGES: Record<string, Record<string, [number, number]>> = {
    head:          { x: [-0.35, 0.35], y: [-0.45, 0.45], z: [-0.35, 0.35] },
    neck:          { x: [-0.25, 0.25], y: [-0.35, 0.35], z: [-0.25, 0.25] },
    spine:         { x: [-0.25, 0.25], z: [-0.15, 0.15] },
    rightUpperArm: { x: [-1.6, 0.3], z: [-1.3, 0.3] },
    rightLowerArm: { x: [0, 1.6] },
    leftUpperArm:  { x: [-1.6, 0.3], z: [-0.3, 1.3] },
    leftLowerArm:  { x: [0, 1.6] },
  };
  const range = SAFE_RANGES[boneName]?.[axis];
  if (!range) return value;
  return Math.max(range[0], Math.min(range[1], value));
}

// In the case 'playPose' handler, before applying bones:
if (cmd.data.bones) {
  const safeBones: BoneMap = {};
  for (const [boneName, rot] of Object.entries(cmd.data.bones)) {
    safeBones[boneName as keyof BoneMap] = {
      x: rot.x !== undefined ? clampBoneVal(boneName, 'x', rot.x) : undefined,
      y: rot.y !== undefined ? clampBoneVal(boneName, 'y', rot.y) : undefined,
      z: rot.z !== undefined ? clampBoneVal(boneName, 'z', rot.z) : undefined,
    };
  }
  state.targetBones = safeBones;
}
```

- [ ] **Step 2: Commit**

```bash
cd character
git add app/components/ExpressionController.tsx
git commit -m "feat: add bone clamping in ExpressionController for AI-generated poses"
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

- [ ] **Step 2: Send a test message likely to trigger action**

Send: "哇，真的吗？！这太惊讶了！"

Expected: Claude responds with something like:
```
真的呢～<action>{"blendShapes":{"surprised":0.9},"bones":{"head":{"x":-0.1}},"duration":1.0,"easing":"easeOut"}</action>哇哦～
```

Character should: show surprised expression + slight head tilt back. Text displayed and spoken should be clean (no `<action>` tag visible).

- [ ] **Step 3: Test with a thinking scenario**

Send: "你觉得人工智能会取代人类吗？"

Expected: Claude uses thinking blend shape or thinking preset, then gives a thoughtful answer.

- [ ] **Step 4: Test neutral conversation (no action)**

Send: "今天几号？"

Expected: Claude responds without any `<action>` tag. Character uses Phase 2 rule-based emotion fallback (or stays neutral).

- [ ] **Step 5: Verify action tag never appears in chat bubble or TTS**

Check the chat bubble text — it should never contain `<action>` literal text. Listen to the TTS — it should never read `action`.

- [ ] **Step 6: TypeScript final check**

```bash
cd character && npx tsc --noEmit
cd EmoMate && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: end-to-end VRM AI-driven animation working"
```

---

## Verification Checklist

- [ ] Claude response containing `<action>` triggers correct VRM pose
- [ ] `<action>` tag is absent from displayed chat messages
- [ ] `<action>` tag is absent from TTS audio (not read aloud)
- [ ] AI-generated bone values stay within safe ranges (no model deformation)
- [ ] Responses without `<action>` still trigger Phase 2 rule-based expressions
- [ ] Expressions, poses, and lip sync all work simultaneously
- [ ] 10-message conversation test: actions appear in emotionally appropriate moments only
- [ ] `npx tsc --noEmit` passes in both projects

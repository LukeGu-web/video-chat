# Motion Coordinator Design

**Date**: 2026-04-24
**Status**: Approved
**Scope**: EmoMate + character WebApp

---

## Problem

The VRM character motion system has two independent channels with no coordination:

- **Channel 1** (has priority): Camera → AI status → Context → `motionMapper` → `CharacterAvatar` → WebView (`playPreset`)
- **Channel 2** (no priority, direct interrupt): AI `<action>` + TTS → `lipSyncBridge` → WebView (`playPose` / `prepareVisemes`)

The two channels meet at `ExpressionController` on the character side, with last-write-wins semantics. `playPose` hard-interrupts any in-progress `playPreset`.

### Four Core Defects

1. **textEmotion link broken**: `emotionStore.setTextEmotion()` is never called. AI reply emotions never drive Channel 1 body presets.
2. **Two channels interrupt each other**: No mechanism for either channel to know the other's state.
3. **No priority on character side**: `setExpression` / `playPose` / `playPreset` overwrite each other freely.
4. **return-to-idle timer race**: Multiple timers fire at wrong times during rapid emotion changes.

### User Goal

Natural, human-like sequencing: laugh then speak, or speak then laugh — never simultaneously. "You smile" → character does face expression **and** body motion, coordinated.

---

## Solution: Unified MotionCoordinator

Replace both channels with a single coordinator on the EmoMate side. All motion signals enter the coordinator; a single output channel goes to the character WebView.

---

## Architecture

```
EmoMate
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Camera Emotion]  [AI Status]  [AI <action>]  [TTS]│
│        ↓               ↓             ↓           ↓  │
│  ┌──────────────────────────────────────────────┐   │
│  │           MotionCoordinator                  │   │
│  │  • Receives all signals                      │   │
│  │  • Maintains state + pending queue           │   │
│  │  • Outputs MotionCommand (type-agnostic)     │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │ single channel                 │
│              CharacterAvatar (registers handler)     │
└─────────────────────┼───────────────────────────────┘
                      │ WebView postMessage
┌─────────────────────▼───────────────────────────────┐
│  character WebApp                                   │
│                                                     │
│  ExpressionController                               │
│    switch (cmd.type)                                │
│      playPreset  → keyframe animation (now)         │
│      setExpression → blendShape                     │
│      prepareVisemes / stopVisemes → lip sync        │
│      playVRMA    → VRMA clip (future extension)     │
└─────────────────────────────────────────────────────┘
```

**VRMA extensibility**: Adding VRMA support later only requires a new `playVRMA` case in `ExpressionController.switch`. `MotionCoordinator` is unchanged — it sends `{ type: 'playVRMA', data: { name: 'dance' } }` the same way it sends `playPreset`.

---

## MotionCoordinator State Machine

### States

```
Idle
Thinking                 ← highest priority, interrupts everything
TTS_Speaking             ← TTS playing words → speaking animation
TTS_Laughing             ← TTS playing laugh sounds → laugh animation
TTS_Emotion(type)        ← TTS playing emotional sentence → emotion preset
PostTTS_Emotion(type)    ← TTS just ended → play emotion once, then Idle
CameraEmotion(type)      ← camera-driven, only active when Idle
```

### Input Events and Transitions

```
onAIThinking(true)
  → any state → Thinking, send playPreset("thinking")

onAIThinking(false)
  → Idle (or resume pending emotion)

onTTSStart(hint)
  hint = "laugh"              → TTS_Laughing, send playPreset("laugh")
  hint = "speaking" or absent → TTS_Speaking, send playPreset("speaking")
  hint = any EmotionType      → TTS_Emotion(hint), send corresponding preset
  (coordinator maps emotion → preset using the same table as <action>)

onTTSEnd()
  pendingEmotion exists       → PostTTS_Emotion, send preset + setExpression, clear pending
  otherwise                   → Idle, send playPreset("idle")

onAIAction(emotion)           ← from <action> tag
  TTS playing                 → store as pendingEmotion (do not interrupt)
  Idle                        → PostTTS_Emotion, play immediately

onCameraEmotion(emotion)
  Idle state                  → CameraEmotion, send preset
                                duration from getMotionDuration(preset), then auto-return to Idle
  any other state             → ignore

onVisemes(data)               ← TTS lip sync
  any state                   → always pass through, bypasses state machine
```

### Natural Sequence Example

```
User: "你笑一笑"
AI response: "<action>{"emotion":"laugh"}</action>哈哈哈！好呀，一起笑吧！"

1. <action> parsed → onAIAction("laugh"), TTS not started yet → pendingEmotion = "laugh"
2. onTTSStart("哈哈哈！", hint="laugh") → TTS_Laughing, send playPreset("laugh")
3. onTTSEnd() → next sentence continues
4. onTTSStart("好呀，一起笑吧！", hint="speaking") → TTS_Speaking, send playPreset("speaking")
5. onTTSEnd() (all done) → pendingEmotion = "laugh"
   → PostTTS_Emotion, send playPreset("laugh") + setExpression({joy: 0.8})
   → 3s later → Idle
```

---

## `<action>` Format Change

### New Format (high-level semantic)

```json
<action>{"emotion":"laugh"}</action>
<action>{"emotion":"joy"}</action>
```

### Supported emotion values

| emotion | preset triggered | blendShape |
|---|---|---|
| `joy` | happy | joy: 0.8 |
| `laugh` | laugh | joy: 0.6 |
| `surprise` | surprised | surprised: 0.9 |
| `shy` | shy | joy: 0.3 |
| `sad` | sleepy | sorrow: 0.7 |
| `excited` | excited | joy: 0.8 |
| `thinking` | thinking | — |
| `trust` | happy | joy: 0.4 |

### AI Prompt Rule (added to `constants/ai.ts`)

```
When expressing emotion, insert an <action> tag before the relevant sentence:

<action>{"emotion":"laugh"}</action>哈哈哈，真的好笑！
<action>{"emotion":"joy"}</action>太棒了，我很开心！

Rules:
- Max 1–2 <action> tags per reply
- Only use when emotion is clear and strong
- emotion values: joy / laugh / surprise / shy / sad / excited / thinking / trust
```

### `parseVRMAction.ts` Updated Return Type

```typescript
interface ActionIntent {
  emotion: EmotionType;
}

function parseVRMAction(text: string): {
  intent: ActionIntent | null;
  cleanText: string;
  hasPartialTag: boolean;
}
```

On parse: call `emotionStore.setTextEmotion(intent.emotion)` (fixes broken link) and `coordinator.onAIAction(intent.emotion)`.

---

## TTS Animation Hint Integration

### How hints attach to sentences

`<action>` appears before a sentence in the stream. The parser "sticks" the emotion to the next sentence:

```
useChatAI.ts stream processing:

rawBuffer: "<action>{"emotion":"laugh"}</action>哈哈哈！好呀！"

1. intent = { emotion: "laugh" } → pendingHint = "laugh"
2. onSentence("哈哈哈！") → enqueue("哈哈哈！", { animationHint: "laugh" })
   pendingHint = null  ← consumed by the immediately following sentence
3. onSentence("好呀！") → enqueue("好呀！", {})  ← default: speaking

If two <action> tags appear before two sentences, each tag's hint attaches to the
sentence that immediately follows it (pendingHint is replaced on each new tag, so
it always attaches to the very next sentence).
```

### Type change

```typescript
// types/speak/common.ts
interface TTSSynthesisOptions {
  voiceId?: string;
  emotion?: string;
  language?: string;
  animationHint?: string;  // NEW: "laugh" | "speaking" | "emotion:joy" etc.
}
```

### TTSQueue callback wiring

```typescript
// useTTSQueue.ts
onItemStart: (item) => {
  const hint = item.options?.animationHint ?? 'speaking';
  motionCoordinator.onTTSStart(hint);
  config?.onItemStart?.(item);
},
onItemEnd: (item) => {
  motionCoordinator.onTTSEnd();
  config?.onItemEnd?.(item);
},
```

### Laugh auto-detection (fallback)

If a sentence consists entirely of laugh characters (`哈哈` / `嘿嘿` / `呵呵` / `haha` etc.) and has no explicit hint, automatically set `animationHint = "laugh"`.

---

## Character Side Changes

### ExpressionController: lightweight priority guard

```typescript
const CMD_PRIORITY = {
  setExpression: 0,  // face only, always applies
  playPose:      1,  // legacy path, kept for transition
  playPreset:    2,  // coordinator-issued preset
  // future: playVRMA: 3
};

let currentPriority = 0;

// On playPreset:
if (CMD_PRIORITY.playPreset >= currentPriority) {
  currentPriority = CMD_PRIORITY.playPreset;
  // run animation...
  // on animation end: currentPriority = 0
}
```

`setExpression` and `prepareVisemes` / `stopVisemes` are always applied regardless of priority — they are independent layers that do not conflict with body motion.

### idleReturnTimer simplification

The coordinator sends `playPreset("idle")` after `onTTSEnd()` and after `PostTTS_Emotion` completes. `ExpressionController`'s internal `idleReturnTimer` can be removed or kept only as a safety fallback.

---

## Bug Fixes (implicit)

| Bug | Resolution |
|---|---|
| textEmotion link broken | `parseVRMAction` now calls `setTextEmotion()` on every parsed action |
| Two channels interrupt each other | Eliminated — only one channel exists |
| No priority on character side | Priority guard added to `ExpressionController` |
| return-to-idle timer race | Coordinator manages all timing; component-level timers removed |

---

## Files Changed

| File | Change type | Content |
|---|---|---|
| `capabilities/motion/MotionCoordinator.ts` | **New** | State machine, ~200 lines |
| `utils/parseVRMAction.ts` | Modify | Parse new high-level format |
| `constants/ai.ts` | Modify | Add `<action>` prompt rule |
| `hooks/useChatAI.ts` | Modify | Wire coordinator; pass animationHint |
| `types/speak/common.ts` | Modify | Add `animationHint` field |
| `capabilities/speak/hooks/useTTSQueue.ts` | Modify | Trigger coordinator on item start/end |
| `components/CharacterAvatar.tsx` | Modify | Register coordinator output handler |
| `components/EmotionAwareCharacter.tsx` | Modify | Route camera emotion through coordinator |
| `character/app/components/ExpressionController.tsx` | Modify | Add priority guard |

---

## Work Estimate

| Task | Days |
|---|---|
| MotionCoordinator design + implementation | 1.5 |
| AI prompt + parser update | 0.5 |
| Wiring (useChatAI, TTSQueue, CharacterAvatar, EmotionAwareCharacter) | 1.0 |
| character side priority fix | 0.5 |
| Integration testing | 1.0 |
| **Total** | **~4–5 days** |

---

## Out of Scope

- VRMA animation support (planned separately): the `playVRMA` command type in `ExpressionController` is the designated extension point; no other changes needed
- Expand emotion types beyond current 8 (Plutchik)
- Cloud sync or persistence of motion state

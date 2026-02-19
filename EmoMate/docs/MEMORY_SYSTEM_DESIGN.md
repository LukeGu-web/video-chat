# Memory System Design

**Date**: 2026-02-19
**Status**: Design approved, pending implementation
**Goal**: Make conversations feel natural and continuous — like talking to a real friend

---

## Background

The core problem is not just "the AI doesn't remember you." It's that **there is no sense of shared life between the user and LanLan**. Real friendships feel natural because:

- Your friend remembers what you said last time
- Your friend proactively brings up things from before
- You have ongoing "threads" — things you follow together over time
- There is no need to "find a topic" — shared history creates natural hooks

The five pain points identified:

| # | Pain Point | Root Cause |
| --- | --- | --- |
| 1 | Every new conversation starts from zero | No memory persistence |
| 2 | Replies feel formulaic or overly sweet | Personality prompt not grounded in user context |
| 3 | LanLan never mentions past conversations | No memory injection |
| 4 | Response rhythm feels unnatural | (Separate concern) |
| 5 | User doesn't know what to talk about | No conversation seeds from shared history |

---

## Architecture Overview

```text
[Conversation in progress]
User message → Claude reply
                  ↓ Every 20 messages / 5-minute silence
             Extraction pipeline (Haiku) → Write to MMKV + SQLite

[App goes to background]
Mark pendingExtraction → Process on next launch

[Conversation starts]
Read 4-layer memory → Assemble system prompt memory block
                    → Generate topic seeds
                    → LanLan naturally references last session
```

---

## Four-Layer Memory Architecture

### Layer 1 — User Profile

**Storage**: MMKV (JSON)
**Update frequency**: Very slow (almost never changes)
**Always injected**: Yes

```typescript
interface UserProfile {
  name?: string;
  occupation?: string;
  tags: string[];             // e.g. ['学生', '夜猫子', '内向']
  typicalActiveHour?: number; // e.g. 22 = 10pm
  preferredLanguage: 'zh' | 'en';
}
```

### Layer 2 — User Preferences

**Storage**: MMKV (JSON)
**Update frequency**: Slow (gradually calibrated from behavior)
**Always injected**: Yes

```typescript
interface UserPreferences {
  wantsAdvice: boolean;      // false = just wants to be heard
  prefersHumor: boolean;
  replyLength: 'short' | 'medium' | 'long';
  sensitiveTopics: string[]; // topics to avoid
  formalityLevel: 'casual' | 'formal';
}
```

### Layer 3 — Episode Summaries

**Storage**: SQLite
**Update frequency**: After each extraction trigger
**Injected**: Most recent 5 episodes

```sql
CREATE TABLE episodes (
  id           INTEGER PRIMARY KEY,
  timestamp    INTEGER NOT NULL,
  summary      TEXT NOT NULL,    -- max 100 characters
  topics       TEXT,             -- JSON array: ['考试', '压力']
  user_emotion TEXT,             -- 'happy' | 'sad' | 'anxious' | 'neutral'
  key_events   TEXT,             -- JSON array: ['said she wants to travel', 'mentioned mom']
  last_words   TEXT              -- verbatim last message for session continuity
);
```

### Layer 4 — Knowledge Facts

**Storage**: SQLite
**Update frequency**: Real-time (extracted as mentioned)
**Injected**: High-importance facts (max 20)

```sql
CREATE TABLE facts (
  id          INTEGER PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER,
  category    TEXT NOT NULL,          -- 'person'|'preference'|'goal'|'event'|'opinion'
  entity      TEXT,                   -- '猫', '考试', '电影'
  content     TEXT NOT NULL,          -- '有只橘猫叫小白'
  tags        TEXT,                   -- JSON array for search
  importance  TEXT DEFAULT 'normal',  -- 'high' | 'normal'
  expires_at  INTEGER                 -- NULL = permanent; or Unix timestamp
);
```

`expires_at` handles time-sensitive facts. For example, "has an exam next week" naturally expires after the exam date — it won't become permanent noise.

---

## Extraction Pipeline

### Trigger Strategy

| Trigger | When | Purpose |
| --- | --- | --- |
| Every 20 messages | During active use | Rolling extraction, prevents message buildup |
| 5-minute silence | During long pauses | Natural break point |
| App goes to background | User closes/switches app | Universal fallback, catches short sessions |
| App launches (startup check) | Next open after backgrounding | Safety net for failed extractions |

### Background Trigger Implementation

When the app goes to background, there are only ~30 seconds of execution time (iOS). Heavy operations will be killed. Solution:

```text
App goes to background (AppState: active → background)
    ↓
Immediately write to MMKV (milliseconds):
  { pendingExtraction: true, unprocessedMessages: [...] }
    ↓
App suspends

App launches next time
    ↓
Check for pendingExtraction flag
    ↓ found
Run extraction silently in background before loading UI
Clear flag on completion
```

### Extraction Prompt

One Claude (Haiku) call extracts all four layers simultaneously:

```json
// Prompt instructs Claude to return this structure:
{
  "profile": {
    "name": "...",
    "occupation": "...",
    "tags": ["..."]
  },
  "preferences": {
    "wantsAdvice": true,
    "replyLength": "short"
  },
  "episode": {
    "summary": "summary in under 100 characters",
    "topics": ["exam", "stress"],
    "user_emotion": "anxious",
    "key_events": ["said exam is next week", "mentioned poor sleep"],
    "last_words": "verbatim last message from user"
  },
  "facts": [
    {
      "category": "goal",
      "entity": "exam",
      "content": "has final exam next week, feeling a lot of pressure",
      "tags": ["school", "exam"],
      "importance": "high",
      "expires_at": "2026-03-01"
    }
  ]
}
```

- `profile` — only fill if new information found, otherwise `null`
- `preferences` — only fill if a clear preference signal was detected
- `episode` — always fill
- `facts` — list any recordable facts mentioned; empty array if none

**Use Haiku, not Sonnet** — structured extraction does not require the most capable model. Faster and cheaper.

---

## Injection Pipeline

### Token Budget

```text
User profile + preferences    ~100 tokens   (always injected)
Last 5 episode summaries      ~400 tokens   (always injected)
High-importance facts         ~200 tokens   (always injected)
─────────────────────────────────────────────────────────────
Total                         ~700 tokens   (acceptable overhead)
```

### Memory Block Structure (injected into system prompt)

```text
# About this user
Name: Xiaoming, university student, usually chats late at night

# User preferences
- Does not like being given direct advice, prefers to be heard
- Prefers short replies, occasional humor

# Recent memory
[3 days ago] Talked about exam stress, anxious, said "no matter how much I study it feels like not enough"
[yesterday] Mood improved, talked about favorite game, mentioned wanting a new GPU
[earlier today] Said headache, probably didn't sleep well

# Important facts
- Has an orange cat named Xiaobai [pet]
- Final exam next week [goal / high priority]
- Does not like horror movies [preference]
```

### Conversation Continuity Instruction

Added to system prompt to address the "starts from zero" and "nothing to talk about" pain points:

```text
# Opening behavior
If the user sends a simple greeting or short message,
naturally bring up one thing you remember — for example:
- "You mentioned your exam was coming up — how did it go?"
- "How is Xiaobai doing?"
- "You had a headache earlier, feeling better now?"

Do not do this every time — only when it feels natural.
Never list multiple things at once. One reference per opening.
```

### Topic Seeds

Generated at conversation start from memory. Used when the user says they "don't know what to talk about":

```typescript
interface TopicSeed {
  topic: string; // e.g. "exam results"
  hook: string;  // e.g. "你说下周要考试，结果怎么样了？"
  source: 'event' | 'fact' | 'episode';
}

// Generation logic:
// 1. Upcoming/recently expired facts (exam tomorrow, trip next week)
// 2. Unresolved threads from recent episodes (mentioned wanting to buy something)
// 3. Emotional follow-ups (was anxious 3 days ago — check in)
```

LanLan does not recite these seeds directly. They inform her proactive behavior — she brings them up naturally when the conversation has a lull.

---

## Solving the Five Pain Points

| Pain Point | Solution |
| --- | --- |
| Every conversation starts from zero | Profile + recent episodes always injected |
| Replies feel formulaic | Preferences layer adjusts personality prompt to match user style |
| Never mentions past | Conversation continuity instruction + `last_words` field |
| Doesn't know what to talk about | Topic seeds generated from memory |
| Response rhythm | (Handled separately by personality prompt tuning) |

---

## Integration with Existing Architecture

- **Extraction triggers**: Extend `useAppStateSceneTimer.ts` for background detection; reuse silence detection from proactive conversation system
- **MMKV**: Already used by `chatStore.ts` and `userStore.ts` — add profile and preferences keys
- **SQLite**: Add via `expo-sqlite` — new dependency
- **Extraction call**: New `useMemoryExtraction.ts` hook
- **Injection**: Extend `buildAIContext.ts` with memory block assembly
- **Prompt caching**: The memory block (profile + preferences) is stable enough to be cached with `cache_control: ephemeral`

---

## What This Does Not Cover

- **Multi-language memory**: Memory extracted and stored in the language used. Cross-language retrieval not addressed.
- **Memory editing UI**: No user-facing interface to view or correct memories. Future consideration.
- **Memory conflicts**: If user gives contradictory information (e.g., changes job), latest fact overwrites. No conflict resolution logic.
- **Privacy**: All data is local. No encryption at rest in this design.

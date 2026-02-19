# Memory System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 4-layer persistent memory system so LanLan remembers the user across sessions and conversations feel continuous.

**Architecture:** MMKV stores the user profile and preferences (small, always-injected layers). SQLite stores episode summaries and knowledge facts (queryable, growing layers). Claude Haiku extracts memories from conversation segments triggered by silence, message count, and app backgrounding. Memory is injected into the system prompt at conversation start.

**Tech Stack:** expo-sqlite (new), react-native-mmkv (existing), Claude Haiku API (existing), Zustand + Immer (existing), AppState (existing)

**Design doc:** `EmoMate/docs/MEMORY_SYSTEM_DESIGN.md`

---

## Phase 1 — Foundation (Tasks 1 and 2 are independent, run in parallel)

---

### Task 1: TypeScript Types + SQLite Database

**Files:**

- Create: `EmoMate/src/types/memory.ts`
- Create: `EmoMate/src/store/memoryDatabase.ts`

**Step 1: Install expo-sqlite**

```bash
cd EmoMate
npx expo install expo-sqlite
```

Expected: package added to package.json, no errors.

**Step 2: Create the type definitions**

Create `EmoMate/src/types/memory.ts`:

```typescript
// Memory system TypeScript types

export interface UserProfile {
  name?: string;
  occupation?: string;
  tags: string[];             // e.g. ['学生', '夜猫子', '内向']
  typicalActiveHour?: number; // e.g. 22 = 10pm
  preferredLanguage: 'zh' | 'en';
}

export interface UserPreferences {
  wantsAdvice: boolean;       // false = user just wants to be heard
  prefersHumor: boolean;
  replyLength: 'short' | 'medium' | 'long';
  sensitiveTopics: string[];
  formalityLevel: 'casual' | 'formal';
}

export interface Episode {
  id?: number;
  timestamp: number;
  summary: string;            // max 100 characters
  topics: string[];
  userEmotion: string;        // 'happy' | 'sad' | 'anxious' | 'neutral' | 'excited'
  keyEvents: string[];
  lastWords: string;          // verbatim last user message, for session continuity
}

export type FactCategory = 'person' | 'preference' | 'goal' | 'event' | 'opinion';
export type FactImportance = 'high' | 'normal';

export interface Fact {
  id?: number;
  createdAt: number;
  updatedAt?: number;
  category: FactCategory;
  entity?: string;            // e.g. '猫', '考试'
  content: string;            // e.g. '有只橘猫叫小白'
  tags: string[];
  importance: FactImportance;
  expiresAt?: number;         // Unix timestamp; undefined = permanent
}

// Shape Claude Haiku returns from extraction prompt
export interface ExtractionResult {
  profile: Partial<UserProfile> | null;
  preferences: Partial<UserPreferences> | null;
  episode: Omit<Episode, 'id'>;
  facts: Omit<Fact, 'id' | 'createdAt' | 'updatedAt'>[];
}

export interface TopicSeed {
  topic: string;
  hook: string;               // natural conversation opener in Chinese
  source: 'event' | 'fact' | 'episode';
}
```

**Step 3: Create the database module**

Create `EmoMate/src/store/memoryDatabase.ts`:

```typescript
import * as SQLite from 'expo-sqlite';
import { Episode, Fact } from '../types/memory';
import { debugLog, debugWarn } from '../utils/debug';

const DB_NAME = 'memory.db';

let db: SQLite.SQLiteDatabase | null = null;

// Open database and create tables if they don't exist
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(database: SQLite.SQLiteDatabase): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS episodes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp    INTEGER NOT NULL,
      summary      TEXT NOT NULL,
      topics       TEXT NOT NULL DEFAULT '[]',
      user_emotion TEXT NOT NULL DEFAULT 'neutral',
      key_events   TEXT NOT NULL DEFAULT '[]',
      last_words   TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS facts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER,
      category    TEXT NOT NULL,
      entity      TEXT,
      content     TEXT NOT NULL,
      tags        TEXT NOT NULL DEFAULT '[]',
      importance  TEXT NOT NULL DEFAULT 'normal',
      expires_at  INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_facts_importance ON facts(importance);
    CREATE INDEX IF NOT EXISTS idx_facts_expires ON facts(expires_at);
  `);
  debugLog('memoryDatabase', 'Schema initialized');
}

// Episodes
export function insertEpisode(episode: Omit<Episode, 'id'>): void {
  const db = getDatabase();
  db.runSync(
    `INSERT INTO episodes (timestamp, summary, topics, user_emotion, key_events, last_words)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      episode.timestamp,
      episode.summary,
      JSON.stringify(episode.topics),
      episode.userEmotion,
      JSON.stringify(episode.keyEvents),
      episode.lastWords,
    ]
  );
}

export function getRecentEpisodes(limit: number = 5): Episode[] {
  const db = getDatabase();
  const rows = db.getAllSync<{
    id: number;
    timestamp: number;
    summary: string;
    topics: string;
    user_emotion: string;
    key_events: string;
    last_words: string;
  }>(`SELECT * FROM episodes ORDER BY timestamp DESC LIMIT ?`, [limit]);

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    summary: row.summary,
    topics: JSON.parse(row.topics),
    userEmotion: row.user_emotion,
    keyEvents: JSON.parse(row.key_events),
    lastWords: row.last_words,
  }));
}

// Facts
export function insertFact(fact: Omit<Fact, 'id' | 'updatedAt'>): void {
  const db = getDatabase();
  db.runSync(
    `INSERT INTO facts (created_at, category, entity, content, tags, importance, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      fact.createdAt,
      fact.category,
      fact.entity ?? null,
      fact.content,
      JSON.stringify(fact.tags),
      fact.importance,
      fact.expiresAt ?? null,
    ]
  );
}

export function getActiveFacts(importanceFilter?: FactImportance): Fact[] {
  const db = getDatabase();
  const now = Date.now();

  const rows = db.getAllSync<{
    id: number;
    created_at: number;
    updated_at: number | null;
    category: string;
    entity: string | null;
    content: string;
    tags: string;
    importance: string;
    expires_at: number | null;
  }>(
    `SELECT * FROM facts
     WHERE (expires_at IS NULL OR expires_at > ?)
     ${importanceFilter ? 'AND importance = ?' : ''}
     ORDER BY importance DESC, created_at DESC`,
    importanceFilter ? [now, importanceFilter] : [now]
  );

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    category: row.category as Fact['category'],
    entity: row.entity ?? undefined,
    content: row.content,
    tags: JSON.parse(row.tags),
    importance: row.importance as Fact['importance'],
    expiresAt: row.expires_at ?? undefined,
  }));
}

export function closeDatabase(): void {
  if (db) {
    db.closeSync();
    db = null;
    debugWarn('memoryDatabase', 'Database closed');
  }
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd EmoMate
npx tsc --noEmit
```

Expected: no errors in the new files.

**Step 5: Commit**

```bash
git add src/types/memory.ts src/store/memoryDatabase.ts package.json
git commit -m "feat(memory): add SQLite schema and TypeScript types"
```

---

### Task 2: MMKV Memory Store (run in parallel with Task 1)

**Files:**

- Create: `EmoMate/src/store/memoryStore.ts`
- Modify: `EmoMate/src/store/index.ts`

**Step 1: Create the MMKV memory store**

Create `EmoMate/src/store/memoryStore.ts`:

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { UserProfile, UserPreferences } from '../types/memory';
import { ChatMessage } from './chatStore';
import { debugLog } from '../utils/debug';

const storage = createMMKV({
  id: 'memory-storage',
  encryptionKey: 'memory-encryption-key',
});

const STORAGE_KEYS = {
  PROFILE: 'user_profile',
  PREFERENCES: 'user_preferences',
  PENDING_EXTRACTION: 'pending_extraction',
  UNPROCESSED_MESSAGES: 'unprocessed_messages',
  LAST_EXTRACTION_TIMESTAMP: 'last_extraction_timestamp',
  PROCESSED_MESSAGE_COUNT: 'processed_message_count',
} as const;

// Default values
const DEFAULT_PROFILE: UserProfile = {
  tags: [],
  preferredLanguage: 'zh',
};

const DEFAULT_PREFERENCES: UserPreferences = {
  wantsAdvice: false,
  prefersHumor: false,
  replyLength: 'short',
  sensitiveTopics: [],
  formalityLevel: 'casual',
};

// MMKV helpers
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getString(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

// Store types
interface MemoryState {
  profile: UserProfile;
  preferences: UserPreferences;
  pendingExtraction: boolean;
  unprocessedMessages: ChatMessage[];
  lastExtractionTimestamp: number | null;
  processedMessageCount: number;
}

interface MemoryActions {
  loadFromStorage: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  setPendingExtraction: (pending: boolean, messages?: ChatMessage[]) => void;
  clearPendingExtraction: () => void;
  setLastExtractionTimestamp: (timestamp: number) => void;
  incrementProcessedCount: (count: number) => void;
  getUnprocessedMessageCount: () => number;
}

type MemoryStore = MemoryState & MemoryActions;

export const useMemoryStore = create<MemoryStore>()(
  immer((set, get) => ({
    // Initial state — will be overwritten by loadFromStorage
    profile: DEFAULT_PROFILE,
    preferences: DEFAULT_PREFERENCES,
    pendingExtraction: false,
    unprocessedMessages: [],
    lastExtractionTimestamp: null,
    processedMessageCount: 0,

    loadFromStorage: () => {
      const profile = loadJSON(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
      const preferences = loadJSON(STORAGE_KEYS.PREFERENCES, DEFAULT_PREFERENCES);
      const pendingExtraction = storage.getBoolean(STORAGE_KEYS.PENDING_EXTRACTION) ?? false;
      const unprocessedMessages = loadJSON<ChatMessage[]>(STORAGE_KEYS.UNPROCESSED_MESSAGES, []);
      const lastExtractionTimestamp = storage.getNumber(STORAGE_KEYS.LAST_EXTRACTION_TIMESTAMP) ?? null;
      const processedMessageCount = storage.getNumber(STORAGE_KEYS.PROCESSED_MESSAGE_COUNT) ?? 0;

      set((state) => {
        state.profile = profile;
        state.preferences = preferences;
        state.pendingExtraction = pendingExtraction;
        state.unprocessedMessages = unprocessedMessages;
        state.lastExtractionTimestamp = lastExtractionTimestamp;
        state.processedMessageCount = processedMessageCount;
      });
      debugLog('memoryStore', 'Loaded from storage', { pendingExtraction, unprocessedMessages: unprocessedMessages.length });
    },

    updateProfile: (updates) => {
      set((state) => {
        Object.assign(state.profile, updates);
        saveJSON(STORAGE_KEYS.PROFILE, state.profile);
      });
      debugLog('memoryStore', 'Profile updated', updates);
    },

    updatePreferences: (updates) => {
      set((state) => {
        Object.assign(state.preferences, updates);
        saveJSON(STORAGE_KEYS.PREFERENCES, state.preferences);
      });
      debugLog('memoryStore', 'Preferences updated', updates);
    },

    setPendingExtraction: (pending, messages) => {
      set((state) => {
        state.pendingExtraction = pending;
        if (messages !== undefined) {
          state.unprocessedMessages = messages;
          saveJSON(STORAGE_KEYS.UNPROCESSED_MESSAGES, messages);
        }
        storage.set(STORAGE_KEYS.PENDING_EXTRACTION, pending);
      });
    },

    clearPendingExtraction: () => {
      set((state) => {
        state.pendingExtraction = false;
        state.unprocessedMessages = [];
        storage.set(STORAGE_KEYS.PENDING_EXTRACTION, false);
        saveJSON(STORAGE_KEYS.UNPROCESSED_MESSAGES, []);
      });
    },

    setLastExtractionTimestamp: (timestamp) => {
      set((state) => {
        state.lastExtractionTimestamp = timestamp;
        storage.set(STORAGE_KEYS.LAST_EXTRACTION_TIMESTAMP, timestamp);
      });
    },

    incrementProcessedCount: (count) => {
      set((state) => {
        state.processedMessageCount += count;
        storage.set(STORAGE_KEYS.PROCESSED_MESSAGE_COUNT, state.processedMessageCount);
      });
    },

    getUnprocessedMessageCount: () => {
      return get().unprocessedMessages.length;
    },
  }))
);
```

**Step 2: Export from store index**

Open `EmoMate/src/store/index.ts` and add:

```typescript
export { useMemoryStore } from './memoryStore';
```

**Step 3: Verify TypeScript**

```bash
cd EmoMate
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/store/memoryStore.ts src/store/index.ts
git commit -m "feat(memory): add MMKV memory store for profile and preferences"
```

---

## Phase 2 — Extraction Pipeline

---

### Task 3: Memory Extraction Hook

**Files:**

- Create: `EmoMate/src/hooks/useMemoryExtraction.ts`

**Step 1: Read these files for context before writing**

- `EmoMate/src/hooks/ai/buildAIContext.ts` (lines 1-60) — understand API call pattern
- `EmoMate/src/store/chatStore.ts` — understand `ChatMessage` shape

**Step 2: Create the extraction hook**

Create `EmoMate/src/hooks/useMemoryExtraction.ts`:

```typescript
import { useCallback } from 'react';
import { getClaudeApiKey, CLAUDE_API_CONFIG } from '../constants/ai';
import { ExtractionResult } from '../types/memory';
import { ChatMessage } from '../store/chatStore';
import { useMemoryStore } from '../store/memoryStore';
import { insertEpisode, insertFact } from '../store/memoryDatabase';
import { debugLog, debugWarn } from '../utils/debug';

// Use haiku for extraction — cheap and fast
const EXTRACTION_MODEL = CLAUDE_API_CONFIG.models.haiku;

const EXTRACTION_SYSTEM_PROMPT = `You extract memory information from conversations between a user and an AI companion called LanLan.
Return ONLY valid JSON matching this exact structure. No explanation, no markdown, just JSON.`;

function buildExtractionPrompt(messages: ChatMessage[]): string {
  const conversation = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'User' : 'LanLan'}: ${m.content}`)
    .join('\n');

  return `Extract memory from this conversation segment:

${conversation}

Return JSON with this structure:
{
  "profile": null or { "name": "...", "occupation": "...", "tags": ["..."] },
  "preferences": null or { "wantsAdvice": bool, "prefersHumor": bool, "replyLength": "short|medium|long", "formalityLevel": "casual|formal" },
  "episode": {
    "timestamp": ${Date.now()},
    "summary": "under 100 characters",
    "topics": ["topic1"],
    "userEmotion": "happy|sad|anxious|neutral|excited",
    "keyEvents": ["event1"],
    "lastWords": "verbatim last user message"
  },
  "facts": [
    {
      "category": "person|preference|goal|event|opinion",
      "entity": "optional entity name",
      "content": "fact description",
      "tags": ["tag1"],
      "importance": "high|normal",
      "expiresAt": null or unix_timestamp_ms
    }
  ]
}

Rules:
- profile: only fill if NEW info found (name, job, etc), otherwise null
- preferences: only fill if CLEAR signal detected, otherwise null
- episode: always fill
- facts: empty array if no notable facts mentioned
- expiresAt: estimate expiry for time-sensitive facts (exam next week → set to ~1 week from now), null for permanent facts`;
}

async function callExtractionAPI(messages: ChatMessage[]): Promise<ExtractionResult> {
  const apiKey = getClaudeApiKey();
  if (!apiKey) throw new Error('Claude API key missing');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildExtractionPrompt(messages) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Extraction API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text ?? '';

  return JSON.parse(text) as ExtractionResult;
}

export interface UseMemoryExtractionReturn {
  extractAndSave: (messages: ChatMessage[]) => Promise<void>;
  processPendingExtraction: () => Promise<void>;
}

export function useMemoryExtraction(): UseMemoryExtractionReturn {
  const { updateProfile, updatePreferences, setPendingExtraction, clearPendingExtraction,
    setLastExtractionTimestamp, incrementProcessedCount, pendingExtraction,
    unprocessedMessages } = useMemoryStore();

  const extractAndSave = useCallback(async (messages: ChatMessage[]): Promise<void> => {
    if (messages.length === 0) return;

    debugLog('useMemoryExtraction', 'Starting extraction', { messageCount: messages.length });

    try {
      const result = await callExtractionAPI(messages);

      // Update profile if new info found
      if (result.profile) {
        updateProfile(result.profile);
        debugLog('useMemoryExtraction', 'Profile updated', result.profile);
      }

      // Update preferences if signal detected
      if (result.preferences) {
        updatePreferences(result.preferences);
        debugLog('useMemoryExtraction', 'Preferences updated', result.preferences);
      }

      // Always save episode
      insertEpisode(result.episode);
      debugLog('useMemoryExtraction', 'Episode saved', { summary: result.episode.summary });

      // Save facts
      if (result.facts.length > 0) {
        for (const fact of result.facts) {
          insertFact({ ...fact, createdAt: Date.now() });
        }
        debugLog('useMemoryExtraction', 'Facts saved', { count: result.facts.length });
      }

      setLastExtractionTimestamp(Date.now());
      incrementProcessedCount(messages.length);
    } catch (error) {
      debugWarn('useMemoryExtraction', 'Extraction failed', error);
      // Don't rethrow — extraction failure should never crash the app
    }
  }, [updateProfile, updatePreferences, setLastExtractionTimestamp, incrementProcessedCount]);

  const processPendingExtraction = useCallback(async (): Promise<void> => {
    if (!pendingExtraction || unprocessedMessages.length === 0) return;

    debugLog('useMemoryExtraction', 'Processing pending extraction', {
      messageCount: unprocessedMessages.length,
    });

    await extractAndSave(unprocessedMessages);
    clearPendingExtraction();
  }, [pendingExtraction, unprocessedMessages, extractAndSave, clearPendingExtraction]);

  return { extractAndSave, processPendingExtraction };
}
```

**Step 3: Verify TypeScript**

```bash
cd EmoMate
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Manual smoke test**

Add a temporary call in the HomeScreen or any screen to confirm extraction runs:

```typescript
const { extractAndSave } = useMemoryExtraction();
// Call with a few fake messages and check debugLog output in console
```

Remove after confirming it runs without errors.

**Step 5: Commit**

```bash
git add src/hooks/useMemoryExtraction.ts
git commit -m "feat(memory): add memory extraction hook with Claude Haiku"
```

---

### Task 4: Trigger System

**Files:**

- Create: `EmoMate/src/hooks/useMemoryTriggers.ts`
- Modify: `EmoMate/src/screens/HomeScreen.tsx` (add startup check + hook mount)

**Step 1: Read HomeScreen to understand current structure**

Read `EmoMate/src/screens/HomeScreen.tsx` fully before editing.

**Step 2: Create the triggers hook**

Create `EmoMate/src/hooks/useMemoryTriggers.ts`:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useMemoryStore } from '../store/memoryStore';
import { useMemoryExtraction } from './useMemoryExtraction';
import { ChatMessage } from '../store/chatStore';
import { debugLog } from '../utils/debug';

const MESSAGE_COUNT_THRESHOLD = 20;  // extract every 20 messages
const SILENCE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface UseMemoryTriggersProps {
  messages: ChatMessage[];
  enabled?: boolean;
}

export function useMemoryTriggers({ messages, enabled = true }: UseMemoryTriggersProps): void {
  const { extractAndSave, processPendingExtraction } = useMemoryExtraction();
  const { setPendingExtraction, lastExtractionTimestamp } = useMemoryStore();

  const lastExtractionIndexRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef(messages);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Startup check: process any pending extraction from last session
  useEffect(() => {
    if (!enabled) return;
    processPendingExtraction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Message count trigger: extract every N messages
  useEffect(() => {
    if (!enabled) return;

    const unprocessedCount = messages.length - lastExtractionIndexRef.current;
    if (unprocessedCount >= MESSAGE_COUNT_THRESHOLD) {
      const segment = messages.slice(lastExtractionIndexRef.current);
      lastExtractionIndexRef.current = messages.length;
      debugLog('useMemoryTriggers', 'Message count trigger fired', { count: unprocessedCount });
      extractAndSave(segment);
    }
  }, [messages, enabled, extractAndSave]);

  // Silence trigger: extract after 5 minutes of no new messages
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      const current = messagesRef.current;
      const segment = current.slice(lastExtractionIndexRef.current);
      if (segment.length === 0) return;

      debugLog('useMemoryTriggers', 'Silence trigger fired', { segmentLength: segment.length });
      lastExtractionIndexRef.current = current.length;
      extractAndSave(segment);
    }, SILENCE_THRESHOLD_MS);
  }, [extractAndSave]);

  // Reset silence timer whenever messages change
  useEffect(() => {
    if (!enabled || messages.length === 0) return;
    resetSilenceTimer();
  }, [messages, enabled, resetSilenceTimer]);

  // Background trigger: mark pending when app goes to background
  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          const current = messagesRef.current;
          const segment = current.slice(lastExtractionIndexRef.current);
          if (segment.length === 0) return;

          debugLog('useMemoryTriggers', 'Background trigger: marking pending', {
            segmentLength: segment.length,
          });
          // Fast MMKV write only — no async work here
          setPendingExtraction(true, segment);
        }
      }
    );

    return () => {
      subscription.remove();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [enabled, setPendingExtraction]);
}
```

**Step 3: Mount the triggers in HomeScreen**

In `EmoMate/src/screens/HomeScreen.tsx`, import and add:

```typescript
import { useMemoryTriggers } from '../hooks/useMemoryTriggers';

// Inside the component, after getting chatHistory from store:
useMemoryTriggers({
  messages: chatHistory,
  enabled: true,
});
```

**Step 4: Verify TypeScript**

```bash
cd EmoMit
npx tsc --noEmit
```

**Step 5: Manual test**

Run the app. Send 20+ messages and confirm debugLog shows "Message count trigger fired". Put app in background and reopen — confirm "Processing pending extraction" appears in logs.

**Step 6: Commit**

```bash
git add src/hooks/useMemoryTriggers.ts src/screens/HomeScreen.tsx
git commit -m "feat(memory): add extraction triggers (message count, silence, background, startup)"
```

---

## Phase 3 — Injection Pipeline

---

### Task 5: Memory Block Injection

**Files:**

- Create: `EmoMate/src/hooks/ai/buildMemoryContext.ts`
- Modify: `EmoMate/src/hooks/ai/buildAIContext.ts`

**Step 1: Read these files fully before editing**

- `EmoMate/src/hooks/ai/buildAIContext.ts`
- `EmoMate/src/constants/ai.ts` (look for `buildSystemPrompt`)

**Step 2: Create the memory context builder**

Create `EmoMate/src/hooks/ai/buildMemoryContext.ts`:

```typescript
import { getRecentEpisodes, getActiveFacts } from '../../store/memoryDatabase';
import { UserProfile, UserPreferences, Episode, Fact } from '../../types/memory';
import { getRelativeTime } from '../../utils/timeFormat';
import { debugLog } from '../../utils/debug';

const MAX_EPISODES = 5;
const MAX_HIGH_IMPORTANCE_FACTS = 20;

function formatProfile(profile: UserProfile): string {
  const parts: string[] = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.occupation) parts.push(profile.occupation);
  if (profile.tags.length > 0) parts.push(profile.tags.join(', '));
  if (profile.typicalActiveHour !== undefined) {
    parts.push(`usually active around ${profile.typicalActiveHour}:00`);
  }
  return parts.join(', ');
}

function formatPreferences(prefs: UserPreferences): string[] {
  const lines: string[] = [];
  if (!prefs.wantsAdvice) lines.push('prefers to be heard, not given advice');
  if (prefs.prefersHumor) lines.push('enjoys light humor');
  if (prefs.replyLength !== 'medium') lines.push(`prefers ${prefs.replyLength} replies`);
  if (prefs.sensitiveTopics.length > 0) {
    lines.push(`avoid topics: ${prefs.sensitiveTopics.join(', ')}`);
  }
  return lines;
}

function formatEpisode(episode: Episode): string {
  const age = getRelativeTime(episode.timestamp);
  return `[${age}] ${episode.summary}`;
}

function formatFact(fact: Fact): string {
  const label = fact.entity ? `[${fact.entity}]` : `[${fact.category}]`;
  return `- ${fact.content} ${label}`;
}

export interface MemoryContext {
  memoryBlock: string;        // injected into system prompt
  lastWords: string | null;   // last user message from most recent episode
  hasMemory: boolean;
}

export function buildMemoryContext(
  profile: UserProfile,
  preferences: UserPreferences
): MemoryContext {
  const episodes = getRecentEpisodes(MAX_EPISODES);
  const highFacts = getActiveFacts('high');
  const allFacts = getActiveFacts();
  const factsToShow = allFacts.slice(0, MAX_HIGH_IMPORTANCE_FACTS);

  const hasMemory = episodes.length > 0 || factsToShow.length > 0;
  const lastWords = episodes.length > 0 ? episodes[0].lastWords || null : null;

  if (!hasMemory && !profile.name) {
    debugLog('buildMemoryContext', 'No memory yet, skipping memory block');
    return { memoryBlock: '', lastWords: null, hasMemory: false };
  }

  const sections: string[] = [];

  // Profile section
  const profileStr = formatProfile(profile);
  if (profileStr) {
    sections.push(`# About this user\n${profileStr}`);
  }

  // Preferences section
  const prefLines = formatPreferences(preferences);
  if (prefLines.length > 0) {
    sections.push(`# User preferences\n${prefLines.map((l) => `- ${l}`).join('\n')}`);
  }

  // Recent episodes
  if (episodes.length > 0) {
    const episodeLines = episodes.map(formatEpisode).join('\n');
    sections.push(`# Recent memory\n${episodeLines}`);
  }

  // Important facts
  if (factsToShow.length > 0) {
    const factLines = factsToShow.map(formatFact).join('\n');
    sections.push(`# Important facts\n${factLines}`);
  }

  const memoryBlock = sections.join('\n\n');

  debugLog('buildMemoryContext', 'Memory block built', {
    episodes: episodes.length,
    facts: factsToShow.length,
    blockLength: memoryBlock.length,
  });

  return { memoryBlock, lastWords, hasMemory };
}
```

**Step 3: Wire memory block into buildAIContext.ts**

In `EmoMate/src/hooks/ai/buildAIContext.ts`, find the `buildCacheableSystemPrompt` function.

Add an import at the top:

```typescript
import { buildMemoryContext } from './buildMemoryContext';
import { useMemoryStore } from '../../store/memoryStore';
```

In `buildCacheableSystemPrompt`, add a new block **after** Block 2 (emotional response):

```typescript
// Block 3: Memory context (user profile + episodes + facts)
// Built outside the component — call buildMemoryContext with store values
// Note: caller must pass memoryBlock string in
if (memoryBlock) {
  systemBlocks.push({
    type: 'text',
    text: `# Memory\n${memoryBlock}`,
    // No cache_control — memory updates frequently
  });
}
```

Update the function signature to accept `memoryBlock?: string`:

```typescript
export function buildCacheableSystemPrompt(
  personality: string,
  userEmotion: string | undefined,
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling',
  backgroundStory?: string,
  environmentContext?: string,
  objectRecognitionContext?: string,
  model: string = 'haiku',
  memoryBlock?: string,          // ← add this
): CacheableSystemBlock[]
```

**Step 4: Pass memory block from useChatAI.ts**

Read `EmoMate/src/hooks/useChatAI.ts` fully, then find where `buildCacheableAPIRequestConfig` or `buildCacheableSystemPrompt` is called. Before the call, build the memory block:

```typescript
import { buildMemoryContext } from './ai/buildMemoryContext';
import { useMemoryStore } from '../store/memoryStore';

// Inside the hook:
const { profile, preferences } = useMemoryStore();
const { memoryBlock } = buildMemoryContext(profile, preferences);

// Pass memoryBlock into the config builder
```

**Step 5: Add the continuity instruction to personality.ts**

Open `EmoMate/src/constants/personality.ts`. Find the main personality string. Append at the end:

```typescript
// Append this to the personality prompt string:
`

# Conversation continuity
If the user sends a simple greeting or short message, naturally bring up ONE thing you remember —
for example referencing a recent worry, an upcoming event, or something they mentioned before.
Do this only when it feels natural. Never list multiple things. One reference per opening.
If you have no memory of this user yet, just respond warmly without forcing a reference.`
```

**Step 6: Verify TypeScript**

```bash
cd EmoMate
npx tsc --noEmit
```

**Step 7: Manual test**

Run the app. Have a short conversation (mention your name or a hobby). Close and reopen. Start a new chat with "hi" — LanLan should reference something from before.

**Step 8: Commit**

```bash
git add src/hooks/ai/buildMemoryContext.ts src/hooks/ai/buildAIContext.ts \
        src/hooks/useChatAI.ts src/constants/personality.ts
git commit -m "feat(memory): inject memory block into system prompt"
```

---

### Task 6: Topic Seeds

**Files:**

- Create: `EmoMate/src/hooks/ai/useTopicSeeds.ts`

**Step 1: Create the topic seeds hook**

Create `EmoMate/src/hooks/ai/useTopicSeeds.ts`:

```typescript
import { useMemo } from 'react';
import { getRecentEpisodes, getActiveFacts } from '../../store/memoryDatabase';
import { TopicSeed } from '../../types/memory';

// Generate 2-3 natural conversation hooks from memory
// These are used by the proactive conversation system when user says
// "I don't know what to talk about"
export function useTopicSeeds(): TopicSeed[] {
  return useMemo(() => {
    const seeds: TopicSeed[] = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // 1. Upcoming/recently expired high-importance facts
    const facts = getActiveFacts('high');
    for (const fact of facts.slice(0, 2)) {
      if (fact.expiresAt && fact.expiresAt - now < 3 * oneDayMs) {
        seeds.push({
          topic: fact.entity ?? fact.category,
          hook: `你之前提到${fact.content}，后来怎么样了？`,
          source: 'fact',
        });
      }
    }

    // 2. Emotional follow-up from recent episodes (was anxious/sad → check in)
    const episodes = getRecentEpisodes(3);
    for (const episode of episodes) {
      const age = now - episode.timestamp;
      if (age > oneDayMs && ['anxious', 'sad'].includes(episode.userEmotion)) {
        seeds.push({
          topic: episode.topics[0] ?? 'recent mood',
          hook: `上次你好像心情不太好，现在好些了吗？`,
          source: 'episode',
        });
        break; // one emotional follow-up is enough
      }
    }

    // 3. Unresolved thread from recent episode key events
    if (episodes.length > 0 && seeds.length < 2) {
      const latest = episodes[0];
      if (latest.keyEvents.length > 0) {
        seeds.push({
          topic: latest.keyEvents[0],
          hook: `上次聊到${latest.keyEvents[0]}，你后来有什么新进展吗？`,
          source: 'episode',
        });
      }
    }

    return seeds.slice(0, 3);
  }, []); // rebuild when component mounts (fresh DB read each session)
}
```

**Step 2: Wire into proactive conversation**

In `EmoMate/src/hooks/ai/useProactiveConversation.ts`, import and use topic seeds as fallback when no context-specific topic is found:

```typescript
import { useTopicSeeds } from './useTopicSeeds';

// Inside useProactiveConversation:
const topicSeeds = useTopicSeeds();

// When selecting a proactive topic, if selectProactiveTopic returns nothing,
// fall back to the first topic seed's hook:
const fallbackHook = topicSeeds[0]?.hook;
```

**Step 3: Verify TypeScript**

```bash
cd EmoMate
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/hooks/ai/useTopicSeeds.ts src/hooks/ai/useProactiveConversation.ts
git commit -m "feat(memory): add topic seeds for proactive conversation from memory"
```

---

## Phase 4 — Integration Check

---

### Task 7: End-to-End Verification

**Step 1: Load memory store on app start**

In `EmoMate/App.tsx` or the root component, call `loadFromStorage` once on mount:

```typescript
import { useMemoryStore } from './src/store';

// Inside root component:
const loadFromStorage = useMemoryStore((s) => s.loadFromStorage);
useEffect(() => {
  loadFromStorage();
}, []);
```

**Step 2: Run the full scenario manually**

1. Launch app fresh. Confirm no errors in console.
2. Have a 5-message conversation. Mention your name and something specific (e.g., "I have a cat").
3. Wait 5 minutes (or set `SILENCE_THRESHOLD_MS` to 10 seconds temporarily for testing).
4. Confirm debugLog shows "Silence trigger fired" and "Episode saved".
5. Close app. Reopen. Confirm "Processing pending extraction" appears.
6. Start new conversation with "hi". LanLan should reference the cat or your name.

**Step 3: Revert any testing shortcuts**

If you changed `SILENCE_THRESHOLD_MS` for testing, restore it to `5 * 60 * 1000`.

**Step 4: Final TypeScript check**

```bash
cd EmoMate
npx tsc --noEmit
```

Expected: zero errors.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(memory): complete 4-layer memory system integration"
```

---

## Summary

| Task | Phase | Dependency |
| --- | --- | --- |
| 1: SQLite schema + types | 1 | none |
| 2: MMKV memory store | 1 | none (parallel with 1) |
| 3: Extraction hook | 2 | tasks 1 + 2 |
| 4: Trigger system | 2 | task 3 |
| 5: Memory injection | 3 | task 4 |
| 6: Topic seeds | 3 | task 5 |
| 7: Integration check | 4 | all |

**New files created:** 6
**Files modified:** 4 (`buildAIContext.ts`, `useChatAI.ts`, `personality.ts`, `HomeScreen.tsx`, `index.ts`, `App.tsx`)
**New dependency:** `expo-sqlite`

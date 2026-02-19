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

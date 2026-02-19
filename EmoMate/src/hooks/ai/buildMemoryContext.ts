import { getRecentEpisodes, getActiveFacts } from '../../store/memoryDatabase';
import { UserProfile, UserPreferences, Episode, Fact } from '../../types/memory';
import { debugLog } from '../../utils/debug';

const MAX_EPISODES = 5;
const MAX_FACTS = 20;

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
  const ageMs = Date.now() - episode.timestamp;
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
  const age = ageDays > 0 ? `${ageDays}d ago` : ageHours > 0 ? `${ageHours}h ago` : 'recently';
  return `[${age}] ${episode.summary}`;
}

function formatFact(fact: Fact): string {
  const label = fact.entity ? `[${fact.entity}]` : `[${fact.category}]`;
  return `- ${fact.content} ${label}`;
}

export interface MemoryContext {
  memoryBlock: string;
  lastWords: string | null;
  hasMemory: boolean;
}

export function buildMemoryContext(
  profile: UserProfile,
  preferences: UserPreferences
): MemoryContext {
  const episodes = getRecentEpisodes(MAX_EPISODES);
  const allFacts = getActiveFacts();
  const factsToShow = allFacts.slice(0, MAX_FACTS);

  const hasMemory = episodes.length > 0 || factsToShow.length > 0;
  const lastWords = episodes.length > 0 ? episodes[0].lastWords || null : null;

  if (!hasMemory && !profile.name) {
    debugLog('buildMemoryContext', 'No memory yet, skipping memory block');
    return { memoryBlock: '', lastWords: null, hasMemory: false };
  }

  const sections: string[] = [];

  const profileStr = formatProfile(profile);
  if (profileStr) {
    sections.push(`# About this user\n${profileStr}`);
  }

  const prefLines = formatPreferences(preferences);
  if (prefLines.length > 0) {
    sections.push(`# User preferences\n${prefLines.map((l) => `- ${l}`).join('\n')}`);
  }

  if (episodes.length > 0) {
    const episodeLines = episodes.map(formatEpisode).join('\n');
    sections.push(`# Recent memory\n${episodeLines}`);
  }

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

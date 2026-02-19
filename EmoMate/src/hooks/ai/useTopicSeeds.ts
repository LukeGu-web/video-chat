import { useMemo } from 'react';
import { getRecentEpisodes, getActiveFacts } from '../../store/memoryDatabase';
import { TopicSeed } from '../../types/memory';

// Generate 2-3 natural conversation hooks from memory.
// These are used by the proactive conversation system when the user has no
// conversation history yet, replacing generic greetings with personalized memory references.
export function useTopicSeeds(): TopicSeed[] {
  return useMemo(() => {
    const seeds: TopicSeed[] = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // 1. Upcoming/recently expiring high-importance facts (within 3 days)
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

    // 2. Emotional follow-up from recent episodes (was anxious/sad more than 1 day ago)
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

    // 3. Unresolved thread from latest episode key events
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
  }, []); // rebuild once per mount — fresh DB read each session
}

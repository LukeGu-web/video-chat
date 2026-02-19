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

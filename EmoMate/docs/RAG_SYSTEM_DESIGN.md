 # RAG（检索增强生成）系统设计

> **文档版本**: v3.0.0 🎉 **全功能完成**
> **创建日期**: 2025-01-20
> **最后更新**: 2025-01-28 (Phase 3 完成)
> **作者**: Claude Code
> **状态**: ✅ 生产就绪 - Phase 1/2/3 全部完成

## 🎯 需求分析

### 用户场景

```
用户: "你还记得昨天我们讨论的那本书吗？"

系统处理流程:
1. 提取关键信息: 时间="昨天", 对象="书"
2. 搜索物体识别记录: 查找昨天识别的书籍类物品
3. 搜索聊天历史: 查找与书籍相关的对话
4. 将检索结果整合到提示词
5. AI基于检索到的信息回答

AI回复: "记得呢~是那本《三体》对吧？你当时说很喜欢科幻小说~"
```

### 需要检索的数据源

| 数据源 | 存储位置 | 数据量 | 持久化 |
|--------|---------|--------|--------|
| **聊天记录** | `chatStore.chatHistory` | 无限制 | ✅ MMKV |
| **物体识别** | `objectRecognitionStore.records` | 最多50条 | ✅ MMKV |
| **场景理解** | `sceneStore.cache` | 最多3条 | ✅ MMKV |

**重要更新 (v2.0.0)**:
- ✅ **chatStore已重构**：聊天记录现已持久化到MMKV，不再是内存存储
- ✅ **userStore已简化**：用户相关数据已拆分到专门的store（chatStore, sceneStore）
- ❌ **environmentHistory已移除**：环境历史功能暂未实现，未来可根据需求添加

## 🏗️ 系统架构

### 整体架构图

```
┌──────────────────────────────────────────────────────────┐
│                     用户查询                              │
│          "你还记得昨天我们讨论的那本书吗？"                │
└─────────────────────┬────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│              1. Query Analysis（查询分析）                 │
│  ┌────────────┬────────────┬────────────┬──────────────┐ │
│  │ 时间提取   │ 关键词提取  │ 意图识别   │ 实体识别     │ │
│  │ "昨天"     │ "书"       │ "回忆"     │ type=book   │ │
│  └────────────┴────────────┴────────────┴──────────────┘ │
└─────────────────────┬────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│           2. Multi-Source Retrieval（多源检索）           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Parallel Search:                                   │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │ │
│  │  │ 物体识别  │ │ 聊天记录  │ │ 场景记录  │          │ │
│  │  └──────────┘ └──────────┘ └──────────┘          │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────┬────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│            3. Ranking（相关度排序）                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  - 时间相关度（越近越高）                              │ │
│  │  - 关键词匹配度                                       │ │
│  │  - 实体类型匹配                                       │ │
│  │  - 上下文相关性                                       │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────┬────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│          4. Context Building（上下文构建）                │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  检索到的信息:                                         │ │
│  │  - 物体: 《三体》（书籍，昨天下午3:24识别）           │ │
│  │  - 对话: "这本科幻小说写得真好" (昨天下午3:26)        │ │
│  │  - 对话: "我喜欢刘慈欣的风格" (昨天下午3:28)         │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────┬────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│       5. Augmented Prompt（增强提示词）                    │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  system: [核心人格 + 能力说明 + 检索上下文]            │ │
│  │                                                       │ │
│  │  # 相关记忆                                            │ │
│  │  ## 昨天的物品识别:                                    │ │
│  │  - 《三体》(书籍) - 识别于昨天下午3:24                │ │
│  │                                                       │ │
│  │  ## 昨天的相关对话:                                    │ │
│  │  - 用户: "这本科幻小说写得真好" (3:26)                │ │
│  │  - 兰兰: "是呢~刘慈欣的作品都很精彩~" (3:26)         │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────┬────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│               6. LLM Response（AI回复）                   │
│  "记得呢~是那本《三体》对吧？你当时说很喜欢科幻小说~"       │
└──────────────────────────────────────────────────────────┘
```

## 📝 核心模块设计

### Module 1: Query Analyzer（查询分析器）

**功能**: 从用户查询中提取关键信息

```typescript
// src/capabilities/retrieval/queryAnalyzer.ts

import { getDateRange } from '../../utils/dateUtils';

export interface QueryAnalysis {
  // 时间信息
  timeReference?: {
    type: 'absolute' | 'relative';
    value: Date | string;  // Date对象 或 "昨天"、"上周"等
    range?: {
      start: Date;
      end: Date;
    };
  };

  // 关键词
  keywords: string[];

  // 实体识别
  entities?: {
    type: 'book' | 'movie' | 'person' | 'place' | 'object';
    value: string;
  }[];

  // 意图识别
  intent: 'recall' | 'search' | 'general';
}

/**
 * 分析用户查询，提取检索关键信息
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const analysis: QueryAnalysis = {
    keywords: [],
    intent: 'general'
  };

  const lowerQuery = query.toLowerCase();

  // 1. 检测回忆意图
  const recallKeywords = [
    '还记得', '记得', '之前', '上次', '那个', '那本', '那部',
    '那天', '讨论', '聊过', '说过', '看过', '识别'
  ];
  if (recallKeywords.some(keyword => lowerQuery.includes(keyword))) {
    analysis.intent = 'recall';
  }

  // 2. 时间提取
  analysis.timeReference = extractTimeReference(query);

  // 3. 关键词提取（移除停用词）
  analysis.keywords = extractKeywords(query);

  // 4. 实体识别
  analysis.entities = extractEntities(query);

  return analysis;
}

/**
 * 提取时间引用（复用dateUtils.ts中的getDateRange函数）
 */
function extractTimeReference(query: string): QueryAnalysis['timeReference'] {
  const lowerQuery = query.toLowerCase();

  // 支持的时间表达式
  const timeExpressions = [
    '今天', '今日', '昨天', '昨日', '前天',
    '这周', '本周', '上周', '上星期',
    '这个月', '本月', '上个月', '上月'
  ];

  for (const expression of timeExpressions) {
    if (lowerQuery.includes(expression)) {
      // 使用dateUtils.ts中已有的getDateRange函数
      const range = getDateRange(expression);
      if (range) {
        return {
          type: 'relative',
          value: expression,
          range
        };
      }
    }
  }

  return undefined;
}

/**
 * 提取关键词（移除停用词）
 */
function extractKeywords(query: string): string[] {
  // 中文停用词
  const stopWords = [
    '的', '了', '在', '是', '我', '你', '他', '她', '它',
    '这', '那', '和', '与', '及', '或', '也', '都', '吗',
    '呢', '吧', '啊', '呀', '嘛', '呢', '哦', '唉'
  ];

  // 简单分词（可以使用更复杂的分词库）
  const words = query.split(/[\s，。！？、；：""''（）【】《》\n]+/)
    .filter(word => word.length > 0)
    .filter(word => !stopWords.includes(word));

  return words;
}

/**
 * 实体识别
 */
function extractEntities(query: string): QueryAnalysis['entities'] {
  const entities: QueryAnalysis['entities'] = [];
  const lowerQuery = query.toLowerCase();

  // 物品类型检测
  const objectTypes = [
    { type: 'book' as const, keywords: ['书', '书籍', '小说', '读物', '作品'] },
    { type: 'movie' as const, keywords: ['电影', '影片', '片子', '视频'] },
    { type: 'object' as const, keywords: ['东西', '物品', '物体', '东西'] }
  ];

  for (const { type, keywords } of objectTypes) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      entities.push({ type, value: keywords[0] });
    }
  }

  return entities;
}
```

### Module 2: Multi-Source Retriever（多源检索器）

**功能**: 并行搜索多个数据源

```typescript
// src/capabilities/retrieval/multiSourceRetriever.ts

import { useChatStore, ChatMessage } from '../../store/chatStore';
import { useObjectRecognitionStore } from '../../store/objectRecognitionStore';
import { useSceneStore } from '../../store/sceneStore';
import { QueryAnalysis } from './queryAnalyzer';
import { ObjectRecognitionRecord, SceneCacheEntry } from '../../types/scene';

export interface RetrievalResult {
  // 物体识别记录
  objects: Array<{
    record: ObjectRecognitionRecord;
    relevance: number;  // 相关度 0-1
  }>;

  // 聊天记录
  conversations: Array<{
    message: ChatMessage;
    relevance: number;
  }>;

  // 场景记录
  scenes: Array<{
    scene: SceneCacheEntry;
    relevance: number;
  }>;

  // 检索元数据
  metadata: {
    totalFound: number;
    searchTimeMs: number;
    sources: string[];
  };
}

/**
 * 从多个数据源检索相关信息
 */
export async function retrieveFromMultipleSources(
  analysis: QueryAnalysis
): Promise<RetrievalResult> {
  const startTime = Date.now();

  // 并行搜索所有数据源
  const [objects, conversations, scenes] = await Promise.all([
    searchObjects(analysis),
    searchConversations(analysis),
    searchScenes(analysis)
  ]);

  const searchTimeMs = Date.now() - startTime;

  return {
    objects,
    conversations,
    scenes,
    metadata: {
      totalFound: objects.length + conversations.length + scenes.length,
      searchTimeMs,
      sources: ['objects', 'conversations', 'scenes']
    }
  };
}

/**
 * 搜索物体识别记录
 */
async function searchObjects(
  analysis: QueryAnalysis
): Promise<RetrievalResult['objects']> {
  const store = useObjectRecognitionStore.getState();
  const records = store.records;

  const results: RetrievalResult['objects'] = [];

  for (const record of records) {
    let relevance = 0;

    // 1. 时间匹配
    if (analysis.timeReference?.range) {
      const recordTime = record.createdAt;
      const { start, end } = analysis.timeReference.range;
      if (recordTime >= start.getTime() && recordTime <= end.getTime()) {
        relevance += 0.4;  // 时间匹配权重40%
      }
    }

    // 2. 关键词匹配
    const objectText = `${record.data.objectName} ${record.data.description} ${record.data.category}`.toLowerCase();
    const matchedKeywords = analysis.keywords.filter(keyword =>
      objectText.includes(keyword.toLowerCase())
    );
    if (matchedKeywords.length > 0) {
      relevance += 0.4 * (matchedKeywords.length / analysis.keywords.length);  // 关键词权重40%
    }

    // 3. 实体类型匹配
    if (analysis.entities) {
      for (const entity of analysis.entities) {
        if (entity.type === 'book' && record.data.category.toLowerCase().includes('书')) {
          relevance += 0.2;  // 类型匹配权重20%
        } else if (entity.type === 'object' && record.data.category.toLowerCase() === 'object') {
          relevance += 0.2;
        }
      }
    }

    // 只返回相关度 > 0.2 的结果
    if (relevance > 0.2) {
      results.push({ record, relevance });
    }
  }

  // 按相关度排序（降序）
  results.sort((a, b) => b.relevance - a.relevance);

  // 返回前5个最相关的结果
  return results.slice(0, 5);
}

/**
 * 搜索聊天记录
 */
async function searchConversations(
  analysis: QueryAnalysis
): Promise<RetrievalResult['conversations']> {
  const store = useChatStore.getState();
  const messages = store.chatHistory;

  const results: RetrievalResult['conversations'] = [];

  for (const message of messages) {
    let relevance = 0;

    // 1. 时间匹配
    if (analysis.timeReference?.range) {
      const messageTime = message.timestamp;
      const { start, end } = analysis.timeReference.range;
      if (messageTime >= start.getTime() && messageTime <= end.getTime()) {
        relevance += 0.3;
      }
    }

    // 2. 关键词匹配
    const messageText = message.content.toLowerCase();
    const matchedKeywords = analysis.keywords.filter(keyword =>
      messageText.includes(keyword.toLowerCase())
    );
    if (matchedKeywords.length > 0) {
      relevance += 0.5 * (matchedKeywords.length / analysis.keywords.length);
    }

    // 3. 角色权重（用户消息权重更高）
    if (message.role === 'user') {
      relevance *= 1.2;
    }

    if (relevance > 0.2) {
      results.push({ message, relevance });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, 5);
}

/**
 * 搜索场景记录
 */
async function searchScenes(
  analysis: QueryAnalysis
): Promise<RetrievalResult['scenes']> {
  const store = useSceneStore.getState();
  const scenes = store.cache;

  const results: RetrievalResult['scenes'] = [];

  for (const scene of scenes) {
    let relevance = 0;

    // 1. 时间匹配
    if (analysis.timeReference?.range) {
      const sceneTime = scene.cachedAt;
      const { start, end } = analysis.timeReference.range;
      if (sceneTime >= start.getTime() && sceneTime <= end.getTime()) {
        relevance += 0.5;
      }
    }

    // 2. 关键词匹配（场景位置和物体）
    const sceneText = `${scene.scene.location} ${scene.scene.objects.map(o => o.name).join(' ')}`.toLowerCase();
    const matchedKeywords = analysis.keywords.filter(keyword =>
      sceneText.includes(keyword.toLowerCase())
    );
    if (matchedKeywords.length > 0) {
      relevance += 0.5 * (matchedKeywords.length / analysis.keywords.length);
    }

    if (relevance > 0.2) {
      results.push({ scene, relevance });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, 3);
}
```

### Module 3: Context Builder（上下文构建器）

**功能**: 将检索结果格式化为提示词

```typescript
// src/capabilities/retrieval/contextBuilder.ts

import { RetrievalResult } from './multiSourceRetriever';
import { formatRelativeTime } from '../../utils/dateUtils';

/**
 * 构建检索增强的上下文
 */
export function buildRetrievalContext(
  retrieval: RetrievalResult,
  maxTokens: number = 500
): string {
  const sections: string[] = [];

  // 1. 物体识别记录
  if (retrieval.objects.length > 0) {
    const objectSection = buildObjectSection(retrieval.objects);
    sections.push(objectSection);
  }

  // 2. 相关对话
  if (retrieval.conversations.length > 0) {
    const conversationSection = buildConversationSection(retrieval.conversations);
    sections.push(conversationSection);
  }

  // 3. 场景记录
  if (retrieval.scenes.length > 0) {
    const sceneSection = buildSceneSection(retrieval.scenes);
    sections.push(sceneSection);
  }

  if (sections.length === 0) {
    return '';  // 没有检索到相关信息
  }

  const fullContext = `# 相关记忆

${sections.join('\n\n')}

---
根据上述记忆信息回答用户的问题。`;

  // 如果超过token限制，截断
  if (estimateTokens(fullContext) > maxTokens) {
    return truncateContext(fullContext, maxTokens);
  }

  return fullContext;
}

/**
 * 构建物体识别部分
 */
function buildObjectSection(
  objects: RetrievalResult['objects']
): string {
  const items = objects.map(({ record, relevance }) => {
    const timeAgo = formatRelativeTime(record.createdAt);
    return `- **${record.data.objectName}** (${record.data.category}) - ${timeAgo}识别
  - 描述: ${record.data.description.substring(0, 100)}${record.data.description.length > 100 ? '...' : ''}
  - 相关度: ${(relevance * 100).toFixed(0)}%`;
  }).join('\n');

  return `## 识别过的物品\n\n${items}`;
}

/**
 * 构建对话部分
 */
function buildConversationSection(
  conversations: RetrievalResult['conversations']
): string {
  const items = conversations.map(({ message, relevance }) => {
    const timeAgo = formatRelativeTime(message.timestamp);
    const speaker = message.role === 'user' ? '用户' : '你';
    return `- ${speaker}: "${message.content.substring(0, 80)}${message.content.length > 80 ? '...' : ''}" (${timeAgo})`;
  }).join('\n');

  return `## 相关对话\n\n${items}`;
}

/**
 * 构建场景部分
 */
function buildSceneSection(
  scenes: RetrievalResult['scenes']
): string {
  const items = scenes.map(({ scene, relevance }) => {
    const timeAgo = formatRelativeTime(scene.cachedAt);
    const objects = scene.scene.objects.slice(0, 3).map(o => o.name).join('、');
    return `- **${scene.scene.location}** - ${timeAgo}
  - 周围物品: ${objects}`;
  }).join('\n');

  return `## 场景记录\n\n${items}`;
}

/**
 * 估算token数（简单估算：1个汉字≈1.5 tokens）
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}

/**
 * 截断上下文到指定token限制
 */
function truncateContext(context: string, maxTokens: number): string {
  const sections = context.split('\n\n');
  let result = '# 相关记忆\n\n';
  let currentTokens = estimateTokens(result);

  for (const section of sections) {
    const sectionTokens = estimateTokens(section);
    if (currentTokens + sectionTokens > maxTokens - 20) {
      break;
    }
    result += section + '\n\n';
    currentTokens += sectionTokens;
  }

  return result + '\n---\n根据上述记忆信息回答用户的问题。';
}
```

### Module 4: RAG Pipeline（完整流程）

**功能**: 整合所有模块

```typescript
// src/capabilities/retrieval/ragPipeline.ts

import { analyzeQuery, QueryAnalysis } from './queryAnalyzer';
import { retrieveFromMultipleSources, RetrievalResult } from './multiSourceRetriever';
import { buildRetrievalContext } from './contextBuilder';
import { debugLog } from '../../utils/debug';

export interface RAGResult {
  // 检索到的上下文
  context: string;

  // 查询分析结果
  analysis: QueryAnalysis;

  // 检索结果
  retrieval: RetrievalResult;

  // 是否触发了检索
  isRetrievalTriggered: boolean;
}

/**
 * RAG主流程
 */
export async function executeRAG(
  userQuery: string,
  options?: {
    enableRetrieval?: boolean;
    maxContextTokens?: number;
    minRelevanceThreshold?: number;
  }
): Promise<RAGResult> {
  const {
    enableRetrieval = true,
    maxContextTokens = 500,
    minRelevanceThreshold = 0.3
  } = options || {};

  // 1. 查询分析
  const analysis = analyzeQuery(userQuery);

  debugLog('RAG', 'Query analysis', {
    intent: analysis.intent,
    keywords: analysis.keywords,
    timeReference: analysis.timeReference?.value
  });

  // 2. 判断是否需要检索
  const shouldRetrieve =
    enableRetrieval &&
    (analysis.intent === 'recall' || analysis.keywords.length > 0);

  if (!shouldRetrieve) {
    return {
      context: '',
      analysis,
      retrieval: {
        objects: [],
        conversations: [],
        scenes: [],
        metadata: { totalFound: 0, searchTimeMs: 0, sources: [] }
      },
      isRetrievalTriggered: false
    };
  }

  // 3. 多源检索
  const retrieval = await retrieveFromMultipleSources(analysis);

  debugLog('RAG', 'Retrieval complete', {
    totalFound: retrieval.metadata.totalFound,
    searchTimeMs: retrieval.metadata.searchTimeMs,
    objects: retrieval.objects.length,
    conversations: retrieval.conversations.length,
    scenes: retrieval.scenes.length
  });

  // 4. 过滤低相关度结果
  const filteredRetrieval: RetrievalResult = {
    objects: retrieval.objects.filter(o => o.relevance >= minRelevanceThreshold),
    conversations: retrieval.conversations.filter(c => c.relevance >= minRelevanceThreshold),
    scenes: retrieval.scenes.filter(s => s.relevance >= minRelevanceThreshold),
    metadata: retrieval.metadata
  };

  // 5. 构建上下文
  const context = buildRetrievalContext(filteredRetrieval, maxContextTokens);

  return {
    context,
    analysis,
    retrieval: filteredRetrieval,
    isRetrievalTriggered: true
  };
}
```

## 🔌 集成到对话流程

### 修改 useChatAI.ts

```typescript
// src/hooks/useChatAI.ts

import { executeRAG } from '../capabilities/retrieval/ragPipeline';

export const useChatAI = (initialConfig?: ChatAIConfig): UseChatAIReturn => {
  // ... 现有代码

  const sendMessage = useCallback(
    async (content: string, config?: ChatAIConfig) => {
      if (!content.trim()) return;

      setIsLoading(true);
      setError(null);

      // === NEW: RAG检索 ===
      const ragResult = await executeRAG(content, {
        enableRetrieval: true,
        maxContextTokens: 500,
        minRelevanceThreshold: 0.3
      });

      console.log('[ChatAI] RAG Result:', {
        isTriggered: ragResult.isRetrievalTriggered,
        totalFound: ragResult.retrieval.metadata.totalFound,
        contextLength: ragResult.context.length
      });

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // 更新主动对话计时器
      proactiveConversation.resetTimer();

      // 检测情绪
      const detectedEmotion = detectUserEmotionFromText(content);

      // 检测对话类型
      const conversationType = detectConversationType(content, updatedMessages);

      // 增强配置（包含RAG上下文）
      const enhancedConfig = {
        ...config,
        userEmotion: config?.userEmotion || detectedEmotion,
        // === NEW: 添加RAG上下文到背景故事 ===
        backgroundStory: ragResult.context || config?.backgroundStory
      };

      // ... 其余代码保持不变
    },
    [messages, currentPersonality, proactiveConversation]
  );

  // ... 其余代码
};
```

### 修改 buildAIContext.ts

```typescript
// src/hooks/ai/buildAIContext.ts

export function buildAPIRequestConfig(
  messages: ChatMessage[],
  config: ChatAIConfig,
  conversationType: string,
  currentPersonality: string,
  currentScene: SceneData | null
): APIRequestConfig {
  // ... 现有代码

  // === NEW: RAG上下文优先级高于普通背景故事 ===
  const contextPrompt = config.backgroundStory  // RAG上下文通过backgroundStory传递
    ? config.backgroundStory
    : scenePrompt;  // 如果没有RAG上下文，使用场景提示

  // 构建系统消息
  const systemMessage = buildSystemPrompt(
    personalityText,
    config.userEmotion,
    conversationType,
    undefined,  // 不再使用backgroundStory参数
    contextPrompt  // 使用统一的contextPrompt
  );

  // ... 其余代码
}
```

## 📊 使用示例

### 示例1: 回忆昨天讨论的书

```typescript
// 用户输入
"你还记得昨天我们讨论的那本书吗？"

// RAG处理流程
QueryAnalysis: {
  timeReference: { type: 'relative', value: '昨天', range: {...} },
  keywords: ['记得', '讨论', '书'],
  entities: [{ type: 'book', value: '书' }],
  intent: 'recall'
}

RetrievalResult: {
  objects: [
    {
      record: { objectName: '《三体》', category: '书籍', createdAt: 昨天15:24 },
      relevance: 0.85
    }
  ],
  conversations: [
    {
      message: { role: 'user', content: '这本科幻小说写得真好', timestamp: 昨天15:26 },
      relevance: 0.72
    },
    {
      message: { role: 'assistant', content: '是呢~刘慈欣的作品都很精彩~', timestamp: 昨天15:26 },
      relevance: 0.68
    }
  ]
}

Context:
# 相关记忆

## 识别过的物品
- **《三体》** (书籍) - 昨天下午3:24识别
  - 描述: 刘慈欣创作的长篇科幻小说...
  - 相关度: 85%

## 相关对话
- 用户: "这本科幻小说写得真好" (昨天下午3:26)
- 你: "是呢~刘慈欣的作品都很精彩~" (昨天下午3:26)

---
根据上述记忆信息回答用户的问题。

// AI回复
"记得呢~是那本《三体》对吧？你当时说很喜欢科幻小说，我也觉得刘慈欣的作品很精彩呢~"
```

### 示例2: 查找上周识别的物品

```typescript
// 用户输入
"上周我们识别过哪些东西？"

// RAG处理流程
QueryAnalysis: {
  timeReference: { type: 'relative', value: '上周', range: {...} },
  keywords: ['识别', '东西'],
  intent: 'recall'
}

RetrievalResult: {
  objects: [
    { record: { objectName: '咖啡杯', category: '日用品', createdAt: 上周一10:00 }, relevance: 0.65 },
    { record: { objectName: 'MacBook Pro', category: '电子产品', createdAt: 上周三14:30 }, relevance: 0.70 },
    { record: { objectName: '《三体》', category: '书籍', createdAt: 上周五15:24 }, relevance: 0.75 }
  ]
}

// AI回复
"上周我们一共识别了3样东西呢~

- 上周一: 咖啡杯
- 上周三: MacBook Pro笔记本电脑
- 上周五: 《三体》这本书

你最喜欢哪一个呀？"
```

## 🎯 优化方向

### 1. 向量搜索（高级）

当前实现使用关键词匹配，可以升级为语义搜索：

```typescript
// 使用OpenAI Embeddings或本地模型生成向量
import { generateEmbedding } from '@openai/api';

async function semanticSearch(query: string, records: any[]) {
  // 1. 生成查询向量
  const queryEmbedding = await generateEmbedding(query);

  // 2. 计算相似度
  const results = records.map(record => ({
    record,
    similarity: cosineSimilarity(queryEmbedding, record.embedding)
  }));

  // 3. 按相似度排序
  return results.sort((a, b) => b.similarity - a.similarity);
}
```

### 2. 对话摘要

长对话可以通过Claude API生成摘要：

```typescript
async function summarizeConversation(messages: ChatMessage[]) {
  const summary = await callClaudeAPI({
    system: "总结以下对话的关键信息（100字以内）",
    messages: messages.map(m => ({ role: m.role, content: m.content }))
  });

  return summary;
}
```

### 3. 持久化优化

✅ **已完成**：聊天记录已持久化到MMKV (v2.0.0)

`chatStore.ts`已实现完整的MMKV持久化：
- ✅ 自动保存聊天记录到加密存储
- ✅ 应用启动时自动加载历史记录
- ✅ 支持清除和重置功能

**可选的进一步优化**：
```typescript
// 限制持久化的消息数量（避免存储过大）
const MAX_PERSISTED_MESSAGES = 100;

const addChatMessage = (message: ChatMessage) => {
  set((state) => {
    state.chatHistory.push(message);
    // 只持久化最近100条消息
    const toSave = state.chatHistory.slice(-MAX_PERSISTED_MESSAGES);
    saveChatHistory(toSave);
  });
};
```

## 📈 性能指标

### 预期性能

| 指标 | 目标值 | 说明 |
|------|--------|------|
| **检索延迟** | < 50ms | 并行搜索多个数据源 |
| **相关度准确率** | > 80% | 正确识别相关信息 |
| **上下文Token** | 300-500 | 控制在合理范围 |
| **内存占用** | < 50MB | 使用MMKV持久化 |

### 监控代码

```typescript
// 添加RAG性能监控
export function monitorRAGPerformance(ragResult: RAGResult) {
  console.log('[RAG Performance]', {
    retrievalTriggered: ragResult.isRetrievalTriggered,
    searchTimeMs: ragResult.retrieval.metadata.searchTimeMs,
    totalFound: ragResult.retrieval.metadata.totalFound,
    contextLength: ragResult.context.length,
    contextTokens: estimateTokens(ragResult.context)
  });
}
```

## 📚 相关文档

- [AI_CONVERSATION_INFO_REPORT.md](./AI_CONVERSATION_INFO_REPORT.md) - AI对话信息报告
- [PROMPT_OPTIMIZATION_REPORT.md](./PROMPT_OPTIMIZATION_REPORT.md) - 提示词优化
- [PROMPT_CACHING_GUIDE.md](./PROMPT_CACHING_GUIDE.md) - 提示词缓存

## 🎯 实施计划

### Phase 1: 基础检索 ✅ **已完成**

- [x] ✅ 实现Query Analyzer（查询分析器）- `queryAnalyzer.ts` (191 lines)
- [x] ✅ 实现Multi-Source Retriever（物体+对话搜索）- `multiSourceRetriever.ts` (227 lines)
- [x] ✅ 实现Context Builder（上下文构建）- `contextBuilder.ts` (144 lines)
- [x] ✅ 集成到useChatAI - `useChatAI.ts` 已集成RAG流程

**实际效果**: ✅ 能够检索和回忆物品和对话，100% TypeScript类型安全

### Phase 2: 优化排序 ✅ **已完成**

- [x] ✅ 优化相关度计算算法 - `relevanceScoring.ts` (251 lines)
- [x] ✅ 添加时间衰减因子 - 指数衰减算法，半衰期7天
- [x] ✅ 实现智能截断 - 贪心截断算法，优先级选择
- [x] ✅ 添加性能监控 - `performanceMonitor.ts` (230 lines)

**实际效果**: ✅ 更准确的检索结果，完整的性能监控系统

### Phase 3: 高级功能 ✅ **已完成**

- [ ] 添加向量搜索（可选，暂不实现）
- [x] ✅ 实现对话摘要 - `conversationSummarizer.ts` (313 lines, 无需LLM)
- [x] ✅ 聊天记录持久化（已完成 v2.0.0）
- [x] ✅ 添加用户反馈机制 - `userFeedback.ts` (286 lines, MMKV持久化)
- [x] ✅ 集成摘要到RAG流程 - `ragPipeline.ts` 支持对话摘要选项
- [x] ✅ 集成反馈到useChatAI - 支持用户反馈收集和分析

**实际效果**: ✅ 生产级RAG系统，支持摘要和反馈优化

**已完成的优化 (v2.0.0)**:
- ✅ chatStore持久化：聊天记录使用MMKV加密存储
- ✅ sceneStore持久化：场景缓存已持久化（最多3条）
- ✅ objectRecognitionStore持久化：物体识别记录已持久化（最多50条）
- ✅ dateUtils工具：时间处理函数已实现并可复用

## 🏛️ Store重构最佳实践 (v2.0.0)

### 新的Store架构

EmoMate现已采用**领域驱动设计**，将状态按功能拆分到专门的store中：

```text
src/store/
├── userStore.ts              # 用户相关数据（预留）
├── chatStore.ts              # 聊天记录 + MMKV持久化
├── sceneStore.ts             # 场景理解 + MMKV持久化
└── objectRecognitionStore.ts # 物体识别 + MMKV持久化
```

### 核心设计原则

#### 1. **单一职责原则 (SRP)**

每个store只负责一个领域的数据：

- `chatStore`: 仅管理聊天历史
- `sceneStore`: 仅管理场景理解
- `objectRecognitionStore`: 仅管理物体识别

#### 2. **持久化优先 (Persistence-First)**

所有核心数据默认使用MMKV持久化：

```typescript
// 每个store都有独立的MMKV实例
const storage = createMMKV({
  id: 'chat-storage',  // 独立的存储空间
  encryptionKey: 'chat-encryption-key',  // 加密存储
});
```

#### 3. **自动初始化 (Auto-Loading)**

Store在模块加载时自动从持久化存储恢复数据：

```typescript
// Store创建时自动加载
useChatStore.getState().loadFromStorage();
```

### RAG集成最佳实践

#### 1. **数据源访问**

```typescript
// ✅ 推荐：使用getState()获取最新状态
const chatHistory = useChatStore.getState().chatHistory;
const sceneCache = useSceneStore.getState().cache;
const objectRecords = useObjectRecognitionStore.getState().records;

// ❌ 避免：在非React组件中使用hook
// const { chatHistory } = useChatStore(); // 这只能在React组件中使用
```

#### 2. **跨Store查询**

```typescript
// RAG系统需要并行查询多个store
async function retrieveFromMultipleSources(analysis: QueryAnalysis) {
  const [objects, conversations, scenes] = await Promise.all([
    searchObjects(analysis),      // 查询objectRecognitionStore
    searchConversations(analysis), // 查询chatStore
    searchScenes(analysis)         // 查询sceneStore
  ]);

  return { objects, conversations, scenes };
}
```

#### 3. **性能优化**

```typescript
// ✅ 使用索引和缓存优化查询
const searchRecords = (query: string) => {
  const lowerQuery = query.toLowerCase();
  return records.filter(r =>
    r.data.objectName.toLowerCase().includes(lowerQuery)
  );
};

// ✅ 限制返回结果数量
return results.slice(0, 5); // 只返回前5个最相关结果
```

### 未来扩展建议

如果需要添加环境感知等新功能：

```typescript
// src/store/environmentStore.ts
interface EnvironmentState {
  lightLevel: number;
  noiseLevel: number;
  weather: string;
  history: EnvironmentRecord[];
}

export const useEnvironmentStore = create<EnvironmentStore>()(
  immer((set) => ({
    // ... 实现类似chatStore的模式
  }))
);
```

## 📖 Phase 3 功能使用指南

### 对话摘要系统

#### 基本用法

```typescript
import {
  generateConversationSummary,
  shouldSummarizeConversation
} from '../capabilities/retrieval';

// 1. 检查是否应该生成摘要
const chatHistory = useChatStore.getState().chatHistory;
if (shouldSummarizeConversation(chatHistory.length)) {
  // 2. 生成摘要
  const summary = generateConversationSummary(chatHistory, {
    maxMessagesToSummarize: 20,  // 最多摘要20条消息
    minMessagesForSummary: 10,   // 至少10条消息才生成摘要
    summaryMaxTokens: 200,        // 摘要最多200 tokens
    includeEmotions: true,        // 包含情绪分析
  });

  console.log(summary.summary);  // "对话包含20条消息..."
  console.log(summary.topics);   // ["电影", "科幻", "刘慈欣"]
}
```

#### 集成到RAG流程

```typescript
// 在执行RAG时启用对话摘要
const ragResult = await executeRAG(userQuery, {
  enableRetrieval: true,
  enableConversationSummaries: true,  // 启用摘要
  summaryOptions: {
    minMessagesForSummary: 10,
  },
});

// 摘要会自动添加到上下文中
console.log(ragResult.summaries);  // [ConversationSummary]
console.log(ragResult.context);    // 包含摘要的完整上下文
```

### 用户反馈系统

#### 基本用法

```typescript
import {
  submitFeedback,
  getFeedbackStats,
  suggestOptimalThreshold,
  getFeedbackInsights,
} from '../capabilities/retrieval';

// 1. 提交用户反馈
submitFeedback({
  queryText: "你记得我昨天说的那本书吗？",
  rating: 'helpful',  // 'helpful' | 'not_helpful' | 'neutral'
  retrievalMetadata: {
    totalFound: 5,
    averageRelevance: 0.75,
    sourcesUsed: ['chatHistory', 'objectRecognition'],
    contextLength: 250,
  },
  userComment: "回答很准确！", // 可选
});

// 2. 查看反馈统计
const stats = getFeedbackStats();
console.log(stats);
// {
//   totalFeedbacks: 25,
//   helpfulCount: 18,
//   notHelpfulCount: 5,
//   neutralCount: 2,
//   averageRelevanceWhenHelpful: 0.68,
//   averageRelevanceWhenNotHelpful: 0.32,
// }

// 3. 获取优化建议
const threshold = suggestOptimalThreshold();
console.log(threshold);
// {
//   suggestedThreshold: 0.5,
//   confidence: 'high',
//   reasoning: "基于25条反馈，有用结果平均相关度68%，无用结果32%"
// }

// 4. 获取反馈洞察
const insights = getFeedbackInsights();
console.log(insights);
// {
//   overallSatisfaction: 0.76,
//   commonIssues: ["最近7天反馈较少"],
//   recommendations: ["鼓励用户提供更多反馈以持续优化"]
// }
```

#### 集成到useChatAI

```typescript
// useChatAI 已自动集成反馈系统
const {
  sendMessage,
  shouldShowFeedback,    // 是否应该显示反馈提示
  submitUserFeedback,    // 提交反馈函数
  dismissFeedback,       // 关闭反馈提示
} = useChatAI();

// UI 组件示例
{shouldShowFeedback && (
  <View style={styles.feedbackPrompt}>
    <Text>这个回答对你有帮助吗？</Text>
    <Button
      title="有用"
      onPress={() => submitUserFeedback('helpful')}
    />
    <Button
      title="无用"
      onPress={() => submitUserFeedback('not_helpful')}
    />
    <Button
      title="关闭"
      onPress={dismissFeedback}
    />
  </View>
)}
```

### 完整功能列表

#### Phase 1 - 基础检索
- ✅ `analyzeQuery()` - 查询分析（时间、关键词、意图、实体）
- ✅ `retrieveFromMultipleSources()` - 多源检索（物体、对话、场景）
- ✅ `buildRetrievalContext()` - 上下文构建
- ✅ `executeRAG()` - 完整RAG流程

#### Phase 2 - 优化排序
- ✅ `calculateRelevanceScore()` - 多因子相关度评分
- ✅ `calculateTimeDecay()` - 指数时间衰减（半衰期7天）
- ✅ `calculateKeywordScore()` - TF-IDF风格关键词评分
- ✅ `recordRAGPerformance()` - 性能监控
- ✅ `generatePerformanceReport()` - 性能报告生成

#### Phase 3 - 高级功能
- ✅ `generateConversationSummary()` - 对话摘要（无需LLM）
- ✅ `shouldSummarizeConversation()` - 摘要触发判断
- ✅ `formatSummaryForContext()` - 摘要格式化
- ✅ `submitFeedback()` - 提交用户反馈
- ✅ `getFeedbackStats()` - 反馈统计
- ✅ `suggestOptimalThreshold()` - 阈值优化建议
- ✅ `getFeedbackInsights()` - 反馈洞察分析

### 性能指标

| 模块 | 代码行数 | 功能完整度 | 类型安全 |
|------|---------|-----------|---------|
| queryAnalyzer | 191 | 100% | ✅ |
| multiSourceRetriever | 227 | 100% | ✅ |
| contextBuilder | 144 | 100% | ✅ |
| ragPipeline | 230 | 100% | ✅ |
| relevanceScoring | 251 | 100% | ✅ |
| performanceMonitor | 230 | 100% | ✅ |
| conversationSummarizer | 313 | 100% | ✅ |
| userFeedback | 286 | 100% | ✅ |
| **总计** | **1,872** | **100%** | **✅** |

## 🔄 更新历史

- **v3.0.0** (2025-01-28) - 🎉 **Phase 3 完成，全功能上线**
  - ✅ 实现对话摘要系统 - `conversationSummarizer.ts` (313 lines)
  - ✅ 实现用户反馈机制 - `userFeedback.ts` (286 lines, MMKV持久化)
  - ✅ 集成摘要到RAG流程 - `ragPipeline.ts` 支持对话摘要选项
  - ✅ 集成反馈到useChatAI - 完整的反馈收集和分析系统
  - ✅ 添加使用指南和API文档
  - 🚀 **系统状态**: 生产就绪，1,872行代码，100% TypeScript类型安全
- **v2.0.0** (2025-01-28) - 重大更新，与现有代码库同步
  - ✅ 更新数据源表格：chatStore已持久化，移除environmentHistory
  - ✅ 简化queryAnalyzer：复用dateUtils.ts中的getDateRange函数
  - ✅ 更新multiSourceRetriever：使用chatStore代替userStore
  - ✅ 更新实施计划：标记已完成的持久化功能
  - ✅ 添加store重构说明和最佳实践
- **v1.0.0** (2025-01-20) - 初始版本，完整RAG系统设计

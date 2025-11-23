/**
 * Object Recognition Announcer
 * Generates natural announcements for recognized objects
 * Adjusts verbosity based on recognition detail level
 */

import { ObjectRecognitionData } from '../types/scene';
import { debugLog } from './debug';

/**
 * Announcement Style
 */
export enum AnnouncementStyle {
  SIMPLE = 'simple',       // Just the name: "这是一个苹果~"
  DETAILED = 'detailed',   // Name + category: "这是一个红色的苹果，属于水果类~"
  ENTHUSIASTIC = 'enthusiastic', // Full details with excitement
}

/**
 * Determine announcement style based on object data completeness
 */
function determineAnnouncementStyle(object: ObjectRecognitionData): AnnouncementStyle {
  const hasDescription = object.description && object.description.length > 10;
  const hasHighConfidence = object.confidence >= 0.8;
  const hasCategory = object.category && object.category !== '未知';

  if (hasDescription && hasHighConfidence && hasCategory) {
    return AnnouncementStyle.DETAILED;
  } else if (hasDescription || hasCategory) {
    return AnnouncementStyle.DETAILED;
  } else {
    return AnnouncementStyle.SIMPLE;
  }
}

/**
 * Generate simple announcement
 */
function generateSimpleAnnouncement(object: ObjectRecognitionData): string {
  const templates = [
    `这是${object.objectName}~`,
    `这个是${object.objectName}呢~`,
    `嗯，这是${object.objectName}~`,
    `我看到的是${object.objectName}~`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate detailed announcement
 */
function generateDetailedAnnouncement(object: ObjectRecognitionData): string {
  const hasCategory = object.category && object.category !== '未知';
  const hasDescription = object.description && object.description.length > 10;

  if (hasDescription && hasCategory) {
    // Full description with category
    const templates = [
      `这是${object.objectName}，${object.description}，属于${object.category}类呢~`,
      `我看到的是${object.objectName}~${object.description}，这是${object.category}类的东西~`,
      `嗯，这个是${object.objectName}，${object.description}~`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  } else if (hasDescription) {
    // Description only
    const templates = [
      `这是${object.objectName}，${object.description}~`,
      `我看到的是${object.objectName}，${object.description}~`,
      `嗯，这个是${object.objectName}~${object.description}~`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  } else if (hasCategory) {
    // Category only
    const templates = [
      `这是${object.objectName}，属于${object.category}类~`,
      `这个是${object.objectName}，是${object.category}类的东西呢~`,
      `嗯，我看到的是${object.objectName}，这是${object.category}~`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // Fallback to simple
  return generateSimpleAnnouncement(object);
}

/**
 * Generate enthusiastic announcement (for high confidence + rich data)
 */
function generateEnthusiasticAnnouncement(object: ObjectRecognitionData): string {
  const templates = [
    `哇！这是${object.objectName}！${object.description}~真有趣呢！`,
    `诶！我认出来了，这是${object.objectName}！${object.description}~`,
    `啊！这个我知道~是${object.objectName}！${object.description}~`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate announcement based on object data
 */
export function generateObjectAnnouncement(
  object: ObjectRecognitionData,
  style?: AnnouncementStyle
): string {
  // Auto-determine style if not provided
  const announcementStyle = style || determineAnnouncementStyle(object);

  debugLog('ObjectRecognitionAnnouncer', 'Generating announcement', {
    objectName: object.objectName,
    style: announcementStyle,
    confidence: object.confidence,
  });

  switch (announcementStyle) {
    case AnnouncementStyle.SIMPLE:
      return generateSimpleAnnouncement(object);

    case AnnouncementStyle.DETAILED:
      return generateDetailedAnnouncement(object);

    case AnnouncementStyle.ENTHUSIASTIC:
      return generateEnthusiasticAnnouncement(object);

    default:
      return generateSimpleAnnouncement(object);
  }
}

/**
 * Error Announcement Templates
 */
const ERROR_ANNOUNCEMENTS = {
  // Low confidence
  lowConfidence: [
    '诶...我好像看不太清楚呢~',
    '嗯...这个有点模糊，我不太确定呢~',
    '抱歉，我看得不太清楚~',
  ],

  // API error
  apiError: [
    '诶...出了点小问题，我没看清~',
    '抱歉，刚才没看清楚呢~',
    '嗯...好像出了点问题~',
  ],

  // General failure
  generalFailure: [
    '抱歉，我没认出来~',
    '诶...这个我认不出来呢~',
    '嗯...我好像不认识这个~',
  ],
};

/**
 * Error Type
 */
export enum RecognitionErrorType {
  LOW_CONFIDENCE = 'lowConfidence',
  API_ERROR = 'apiError',
  GENERAL_FAILURE = 'generalFailure',
}

/**
 * Generate error announcement
 */
export function generateErrorAnnouncement(
  errorType: RecognitionErrorType
): string {
  const templates = ERROR_ANNOUNCEMENTS[errorType];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Retry Prompt Templates
 */
const RETRY_PROMPTS = [
  '要不要再试一次呢？',
  '换个角度试试看？',
  '要重新看一下吗？',
  '再给我看一次好不好~',
];

/**
 * Generate retry prompt
 */
export function generateRetryPrompt(): string {
  return RETRY_PROMPTS[Math.floor(Math.random() * RETRY_PROMPTS.length)];
}

/**
 * Generate full error message with retry prompt
 */
export function generateErrorWithRetry(
  errorType: RecognitionErrorType
): string {
  const errorMsg = generateErrorAnnouncement(errorType);
  const retryPrompt = generateRetryPrompt();
  return `${errorMsg}${retryPrompt}`;
}

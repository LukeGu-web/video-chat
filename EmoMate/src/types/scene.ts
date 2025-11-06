/**
 * Scene Understanding Type Definitions
 * Defines data structures for scene analysis and environment detection
 */

/**
 * Scene details - stores specific object information
 *
 * Optimized for Step 2.2: Structured Scene Data
 * - Defines common optional fields for better type safety
 * - Maintains flexibility with index signature
 * - Provides clear documentation for each field
 *
 * All fields are optional and will only be present if detected with confidence
 */
export interface SceneDetails {
  // === Book Information ===
  /** Title of detected book(s) */
  bookTitle?: string;
  /** Author of detected book(s) */
  bookAuthor?: string;
  /** Multiple books detected (comma-separated) */
  bookList?: string;

  // === Product/Brand Information ===
  /** Detected brand name(s) */
  productBrand?: string;
  /** Detected product category */
  productCategory?: string;
  /** Multiple products (comma-separated) */
  productList?: string;

  // === Text Content ===
  /** Visible text content on screens, signs, etc. */
  textContent?: string;
  /** Language of detected text */
  textLanguage?: string;

  // === People Information (not identifying, just activity) ===
  /** Number of people detected */
  peopleCount?: number;
  /** What people are doing */
  peopleActivity?: string;

  // === Technology/Devices ===
  /** Computer/laptop brand or type */
  computerType?: string;
  /** Phone/tablet brand or type */
  mobileDevice?: string;
  /** Monitor/display information */
  displayInfo?: string;

  // === Food/Beverage ===
  /** Type of food detected */
  foodType?: string;
  /** Type of beverage detected */
  beverageType?: string;

  // === Environment Specifics ===
  /** Time of day indicator (morning, afternoon, evening, night) */
  timeOfDay?: string;
  /** Weather condition (if outdoor scene) */
  weatherCondition?: string;
  /** Indoor/outdoor indicator */
  indoorOutdoor?: 'indoor' | 'outdoor';

  // === Other Notable Details ===
  /** Any other significant details worth noting */
  otherDetails?: string;
  /** Special observations or unique features */
  specialFeatures?: string;

  // === Parsing/Error Information ===
  /** Error message if parsing failed */
  parseError?: string;

  // === Flexibility: Allow any additional string/number/boolean fields ===
  [key: string]: string | number | boolean | undefined;
}

/**
 * Main scene data structure
 * Contains comprehensive information about the detected scene
 */
export interface SceneData {
  /** Scene location/type (e.g., "咖啡馆", "图书馆", "办公室") */
  location: string;

  /** List of detected objects in the scene */
  objects: string[];

  /** Detailed information about specific objects */
  details: SceneDetails;

  /** Overall atmosphere description */
  atmosphere: string;

  /** Lighting condition description */
  lighting: string;

  /** Confidence score (0-1) of the scene analysis */
  confidence: number;

  /** Unix timestamp when the scene was analyzed */
  timestamp: number;

  /** Optional: Raw response from Claude Vision API for debugging */
  rawResponse?: string;
}

/**
 * Scene comparison result
 * Used to determine if a new scene is significantly different from the previous one
 */
export interface SceneComparisonResult {
  /** Similarity score (0-1), higher means more similar */
  similarity: number;

  /** Whether the scenes are considered the same (similarity >= threshold) */
  isSameScene: boolean;

  /** Threshold used for comparison */
  threshold: number;
}

/**
 * Trigger type for scene analysis
 */
export enum SceneTriggerType {
  /** Triggered by scene change detection (image similarity) */
  SCENE_CHANGE = 'scene_change',

  /** Triggered by timer (e.g., every 5 minutes) */
  TIMER = 'timer',

  /** Triggered by conversation keyword */
  KEYWORD = 'keyword',

  /** Manually triggered by user */
  MANUAL = 'manual',
}

/**
 * Scene analysis request
 * Contains all information needed to perform scene analysis
 */
export interface SceneAnalysisRequest {
  /** Base64 encoded image data */
  imageBase64: string;

  /** Trigger type that initiated this analysis */
  triggerType: SceneTriggerType;

  /** Optional: Specific question from user (for keyword-triggered analysis) */
  userQuestion?: string;

  /** Optional: Previous scene data for context */
  previousScene?: SceneData;
}

/**
 * Scene analysis response
 * Contains the result of scene analysis and metadata
 */
export interface SceneAnalysisResponse {
  /** Detected scene data */
  scene: SceneData;

  /** Whether this analysis was successful */
  success: boolean;

  /** Optional: Error message if analysis failed */
  error?: string;

  /** Trigger type that initiated this analysis */
  triggerType: SceneTriggerType;

  /** API call cost in USD (for tracking) */
  cost?: number;
}

/**
 * Scene cache entry
 * Stores scene data with metadata for caching and deduplication
 */
export interface SceneCacheEntry {
  /** Cached scene data */
  scene: SceneData;

  /** When this entry was created */
  cachedAt: number;

  /** When this entry expires (Unix timestamp) */
  expiresAt: number;

  /** Thumbnail of the image (for similarity comparison) */
  imageThumbnail?: string;
}

/**
 * Scene understanding configuration
 */
export interface SceneConfig {
  /** Enable/disable scene understanding feature */
  enabled: boolean;

  /** Timer interval in milliseconds (default: 5 minutes) */
  timerInterval: number;

  /** Scene change detection threshold (0-1, default: 0.7) */
  sceneChangeThreshold: number;

  /** Scene deduplication threshold (0-1, default: 0.85) */
  deduplicationThreshold: number;

  /** Cache expiration time in milliseconds (default: 30 minutes) */
  cacheExpiration: number;

  /** Maximum image size for API call in KB (default: 500) */
  maxImageSizeKB: number;

  /** Conversation keywords that trigger scene analysis */
  triggerKeywords: string[];

  /** Enable debug mode */
  debugMode: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_SCENE_CONFIG: SceneConfig = {
  enabled: true,
  timerInterval: 5 * 60 * 1000, // 5 minutes
  sceneChangeThreshold: 0.7,
  deduplicationThreshold: 0.85,
  cacheExpiration: 30 * 60 * 1000, // 30 minutes
  maxImageSizeKB: 500,
  triggerKeywords: ['看', '看见', '看到', '这是什么', '周围', '环境', '场景'],
  debugMode: process.env.SHOW_TEST_COMPONENTS === 'true',
};

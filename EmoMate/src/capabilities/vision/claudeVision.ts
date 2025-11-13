/**
 * Claude Vision API Integration
 * Handles scene analysis using Claude 3.5 Sonnet Vision API
 */

import {
  SceneData,
  SceneAnalysisRequest,
  SceneAnalysisResponse,
  SceneTriggerType,
  AnalysisMode,
  ObjectRecognitionData,
  ObjectRecognitionRequest,
  ObjectRecognitionResponse,
} from '../../types/scene';
import { compressBase64Image, formatByteSize } from './imageCompression';

/**
 * Claude API configuration
 */
const CLAUDE_API_CONFIG = {
  // API endpoint for Claude messages
  endpoint: 'https://api.anthropic.com/v1/messages',

  // Model to use for vision analysis
  // claude-sonnet-4-5-20250929 $3 / MTok
  // claude-haiku-4-5-20251001  $1 / MTok
  model: 'claude-haiku-4-5-20251001',

  // Maximum tokens for response
  maxTokens: 1024,

  // API version header
  apiVersion: '2023-06-01',
};

/**
 * Compress image to reduce API costs
 * Ensures image is under maxSizeKB while maintaining quality
 *
 * @param imageBase64 - Base64 encoded image
 * @param maxSizeKB - Maximum size in kilobytes
 * @returns Compressed base64 image
 */
export async function compressImage(
  imageBase64: string,
  maxSizeKB: number = 500
): Promise<string> {
  try {
    const { base64: compressedBase64, stats } = await compressBase64Image(
      imageBase64,
      {
        maxSizeBytes: maxSizeKB * 1024,
        maxWidth: 1024, // Optimal for Claude Vision
        compress: 0.7, // Start with 70% quality
      }
    );

    console.log('[ClaudeVision] ✅ Image compression complete:', {
      originalSize: formatByteSize(stats.originalSize),
      compressedSize: formatByteSize(stats.compressedSize),
      savings: `${(stats.compressionRatio * 100).toFixed(1)}%`,
      underLimit: stats.compressedSize <= maxSizeKB * 1024 ? '✓' : '✗',
    });

    return compressedBase64;
  } catch (error) {
    console.error('[ClaudeVision] ⚠️ Image compression failed, using original:', error);
    // Fallback to original image if compression fails
    return imageBase64;
  }
}

/**
 * Build prompt for Claude Vision API based on trigger type
 *
 * Optimized for Step 2.2: Structured Scene Data
 * - Ensures reliable JSON output
 * - Provides clear field definitions
 * - Includes concrete examples
 * - Specifies confidence calculation criteria
 *
 * @param request - Scene analysis request
 * @returns Prompt string for Claude API
 */
function buildAnalysisPrompt(request: SceneAnalysisRequest): string {
  const basePrompt = `请仔细分析这张图片中的场景。你的回复必须是一个有效的JSON对象，不要包含任何其他文字或解释。

请严格按照以下JSON格式返回：

{
  "location": "场景位置/类型（室内：如咖啡馆、图书馆、办公室、卧室、客厅；户外：如公园、街道、校园等）",
  "objects": ["主要物体1", "主要物体2", "主要物体3", ...],
  "details": {
    // 如果识别到书籍，添加：
    "bookTitle": "书名",
    "bookAuthor": "作者",
    // 如果识别到品牌产品，添加：
    "productBrand": "品牌名称",
    // 如果看到屏幕或文字，添加：
    "textContent": "可见的文字内容",
    // 如果识别到人物（但不包括具体身份），添加：
    "peopleCount": 数字,
    "peopleActivity": "正在做什么",
    // 其他特定物体的详细信息
    "otherDetails": "其他值得注意的细节"
  },
  "atmosphere": "整体氛围描述（如：安静学习氛围、热闹社交氛围、专业工作氛围、轻松休闲氛围等）",
  "lighting": "光线情况（如：明亮自然光、柔和室内灯光、昏暗环境、强烈阳光等）",
  "confidence": 0.85
}

关于置信度(confidence)的计算标准：
- 0.9-1.0: 场景非常清晰，物体识别准确，光线充足
- 0.75-0.89: 场景清晰，大部分物体可识别，光线良好
- 0.5-0.74: 场景模糊或光线不佳，部分物体可识别
- 0-0.49: 场景很模糊，物体难以识别

重要提示：
1. objects 数组中只列出可以清楚识别的物体
2. details 对象中只添加你能确认的信息，不确定的字段请省略
3. 如果图片中没有文字、书籍或品牌产品，details 可以是空对象 {}
4. 回复只能是纯JSON，不要添加任何解释文字
5. 确保JSON格式完全正确，可以被 JSON.parse() 解析`;

  // Add specific question if keyword-triggered
  if (
    request.triggerType === SceneTriggerType.KEYWORD &&
    request.userQuestion
  ) {
    return `${basePrompt}

用户问题：「${request.userQuestion}」

请特别关注与用户问题相关的物体，在 details 中提供更详细的信息。如果用户问的是具体某个物体，请重点描述该物体的特征。`;
  }

  // Add context if there's a previous scene
  if (request.previousScene) {
    return `${basePrompt}

上一次场景分析结果：
- 位置：${request.previousScene.location}
- 主要物体：${request.previousScene.objects.join('、')}

如果当前场景与上次基本相同，请在描述中保持一致性（使用相同的 location 描述）。如果场景明显不同，请如实描述新场景。`;
  }

  return basePrompt;
}

/**
 * Build prompt for object recognition mode
 * Focus on detailed analysis of a specific object
 *
 * @param request - Object recognition request
 * @returns Prompt string for Claude API
 */
function buildObjectRecognitionPrompt(request: ObjectRecognitionRequest): string {
  return `请仔细分析这张图片中的物品。用户想要识别这个物品，请提供详细的信息。你的回复必须是一个有效的JSON对象，不要包含任何其他文字或解释。

请严格按照以下JSON格式返回：

{
  "objectName": "物品名称（如：《人类简史》、MacBook Pro、拿铁咖啡等）",
  "category": "物品类别（如：书籍、电子产品、食物、饮料、服装、家具等）",
  "description": "详细描述（包括外观特征、功能用途、使用场景等，2-3句话）",
  "brand": "品牌名称（如果能识别出来）",
  "model": "型号/版本（如果能识别出来）",
  "color": "颜色信息（主要颜色）",
  "material": "材质（如果能看出来）",
  "priceRange": "价格范围估计（如：100-200元，仅供参考）",
  "additionalInfo": {
    // 如果是书籍，添加：
    "author": "作者名",
    "publisher": "出版社",
    "isbn": "ISBN（如果可见）",

    // 如果是电子产品，添加：
    "screenSize": "屏幕尺寸",
    "processor": "处理器信息（如果可见）",
    "storage": "存储容量（如果可见）",

    // 如果是食物/饮料，添加：
    "taste": "口味特点",
    "ingredients": "主要成分",
    "calories": "热量信息（如果可见）",

    // 其他任何相关的详细信息
    "其他字段": "其他值"
  },
  "userPrompt": "${request.userPrompt}",
  "confidence": 0.85
}

用户的问题：「${request.userPrompt}」

关于置信度(confidence)的计算标准：
- 0.9-1.0: 物品非常清晰，细节可见，品牌型号明确
- 0.75-0.89: 物品清晰，主要特征可识别
- 0.5-0.74: 物品识别，但细节不太清楚
- 0-0.49: 物品模糊，难以确定具体信息

重要提示：
1. objectName 应该尽可能具体（如"《人类简史》"而不是"书"）
2. description 要详细描述物品的特征和用途
3. 如果某些信息无法确定（如品牌、型号），该字段可以省略或设为null
4. additionalInfo 中只添加确实能识别出的信息
5. 回复只能是纯JSON，不要添加任何解释文字
6. 确保JSON格式完全正确，可以被 JSON.parse() 解析
7. 重点关注物品本身的细节，而不是周围环境`;
}

/**
 * Parse Claude API response to extract scene data
 *
 * Optimized for Step 2.2: Structured Scene Data
 * - Multiple JSON extraction strategies
 * - Strict field validation with type checking
 * - Data cleaning and normalization
 * - Detailed error messages
 * - Smart fallback mechanisms
 *
 * @param responseText - Raw text response from Claude API
 * @returns Parsed scene data
 */
function parseSceneData(responseText: string): SceneData {
  try {
    console.log('[ClaudeVision] Parsing response text...');

    // Strategy 1: Try to extract JSON from code block (```json ... ```)
    let jsonText: string | null = null;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
      console.log('[ClaudeVision] Found JSON in code block');
    }

    // Strategy 2: Try to extract first complete JSON object
    if (!jsonText) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        console.log('[ClaudeVision] Found JSON object');
      }
    }

    // Strategy 3: Try to find JSON between specific markers
    if (!jsonText) {
      const markerMatch = responseText.match(/(?:JSON|json|结果|分析)[:：]\s*(\{[\s\S]*\})/);
      if (markerMatch) {
        jsonText = markerMatch[1];
        console.log('[ClaudeVision] Found JSON after marker');
      }
    }

    if (!jsonText) {
      throw new Error('No JSON found in response (tried 3 extraction strategies)');
    }

    // Remove comments from JSON (Claude might include them despite instructions)
    jsonText = jsonText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Parse JSON
    const sceneData = JSON.parse(jsonText);
    console.log('[ClaudeVision] JSON parsed successfully');

    // === Strict field validation ===

    // Validate and clean location (required string)
    if (typeof sceneData.location !== 'string' || !sceneData.location.trim()) {
      throw new Error('Invalid or missing "location" field (must be non-empty string)');
    }
    sceneData.location = sceneData.location.trim();

    // Validate and clean objects array (required array of strings)
    if (!Array.isArray(sceneData.objects)) {
      throw new Error('Invalid "objects" field (must be array)');
    }
    sceneData.objects = sceneData.objects
      .filter((obj: any) => typeof obj === 'string' && obj.trim())
      .map((obj: string) => obj.trim());

    // Validate details object (required object, can be empty)
    if (typeof sceneData.details !== 'object' || sceneData.details === null || Array.isArray(sceneData.details)) {
      console.warn('[ClaudeVision] Invalid details field, using empty object');
      sceneData.details = {};
    }

    // Validate and clean atmosphere (required string)
    if (typeof sceneData.atmosphere !== 'string' || !sceneData.atmosphere.trim()) {
      throw new Error('Invalid or missing "atmosphere" field (must be non-empty string)');
    }
    sceneData.atmosphere = sceneData.atmosphere.trim();

    // Validate and clean lighting (required string)
    if (typeof sceneData.lighting !== 'string' || !sceneData.lighting.trim()) {
      console.warn('[ClaudeVision] Missing "lighting" field, using default');
      sceneData.lighting = '未知光线';
    } else {
      sceneData.lighting = sceneData.lighting.trim();
    }

    // Validate and normalize confidence (required number 0-1)
    if (typeof sceneData.confidence !== 'number') {
      console.warn('[ClaudeVision] Invalid confidence field, attempting conversion');
      sceneData.confidence = parseFloat(sceneData.confidence);
    }
    if (isNaN(sceneData.confidence)) {
      console.warn('[ClaudeVision] Cannot parse confidence, using default 0.5');
      sceneData.confidence = 0.5;
    }
    // Clamp confidence to [0, 1]
    sceneData.confidence = Math.max(0, Math.min(1, sceneData.confidence));

    // Add timestamp
    sceneData.timestamp = Date.now();

    // Store raw response for debugging
    sceneData.rawResponse = responseText;

    // Log parsed data summary
    console.log('[ClaudeVision] Parsed scene data:', {
      location: sceneData.location,
      objectCount: sceneData.objects.length,
      detailKeys: Object.keys(sceneData.details),
      confidence: sceneData.confidence,
    });

    return sceneData as SceneData;
  } catch (error) {
    console.error('[ClaudeVision] Failed to parse scene data:', error);
    console.error('[ClaudeVision] Raw response:', responseText);

    // Return comprehensive fallback scene data
    return {
      location: '解析失败',
      objects: [],
      details: {
        parseError: error instanceof Error ? error.message : 'Unknown parsing error',
      },
      atmosphere: '无法分析场景氛围',
      lighting: '无法确定光线情况',
      confidence: 0,
      timestamp: Date.now(),
      rawResponse: responseText,
    };
  }
}

/**
 * Analyze scene using Claude Vision API
 *
 * @param request - Scene analysis request
 * @param apiKey - Anthropic API key
 * @returns Scene analysis response
 */
export async function analyzeSceneWithClaude(
  request: SceneAnalysisRequest,
  apiKey: string
): Promise<SceneAnalysisResponse> {
  const startTime = Date.now();

  try {
    console.log('[ClaudeVision] Starting scene analysis:', {
      triggerType: request.triggerType,
      hasUserQuestion: !!request.userQuestion,
      hasPreviousScene: !!request.previousScene,
    });

    // Compress image if needed
    const compressedImage = await compressImage(request.imageBase64);

    // Build prompt
    const prompt = buildAnalysisPrompt(request);

    // Extract image data (remove data URL prefix if present)
    let imageData = compressedImage;
    if (imageData.startsWith('data:image')) {
      // Remove "data:image/jpeg;base64," prefix
      imageData = imageData.split(',')[1] || imageData;
    }

    console.log('[ClaudeVision] Preparing API request...');
    console.log(
      '[ClaudeVision] Image size:',
      Math.round((imageData.length * 0.75) / 1024),
      'KB'
    );

    // Make API call to Claude Vision
    const response = await fetch(CLAUDE_API_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_API_CONFIG.apiVersion,
      },
      body: JSON.stringify({
        model: CLAUDE_API_CONFIG.model,
        max_tokens: CLAUDE_API_CONFIG.maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageData,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    // Check if response is OK
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Claude API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    // Parse API response
    const apiResponse = await response.json();
    console.log('[ClaudeVision] API response received:', {
      id: apiResponse.id,
      model: apiResponse.model,
      usage: apiResponse.usage,
    });

    // Extract text content from response
    const responseText = apiResponse.content?.[0]?.text || 'No response text';

    // Parse scene data from response
    const scene = parseSceneData(responseText);

    // Calculate actual cost
    const cost = estimateAPICost(
      compressedImage,
      apiResponse.usage?.output_tokens || 300
    );

    const duration = Date.now() - startTime;
    console.log(`[ClaudeVision] Analysis completed in ${duration}ms`);
    console.log('[ClaudeVision] Detected scene:', {
      location: scene.location,
      objectCount: scene.objects.length,
      confidence: scene.confidence,
    });

    return {
      scene,
      success: true,
      triggerType: request.triggerType,
      cost,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ClaudeVision] Analysis failed after ${duration}ms:`, error);

    return {
      scene: {
        location: '分析失败',
        objects: [],
        details: {},
        atmosphere: '无法分析',
        lighting: '未知',
        confidence: 0,
        timestamp: Date.now(),
      },
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      triggerType: request.triggerType,
    };
  }
}

/**
 * Estimate API call cost based on image size and token usage
 * Claude 3.5 Sonnet pricing (as of 2024):
 * - Input: $3 per million tokens
 * - Output: $15 per million tokens
 * - Images: ~1600 tokens for a typical compressed image
 *
 * @param imageBase64 - Base64 encoded image
 * @param outputTokens - Number of output tokens used
 * @returns Estimated cost in USD
 */
export function estimateAPICost(
  imageBase64: string,
  outputTokens: number = 300
): number {
  // Estimate image tokens (rough approximation based on size)
  const imageSizeKB = (imageBase64.length * 0.75) / 1024; // Convert base64 to KB
  const imageTokens = Math.ceil(imageSizeKB * 3.2); // ~3.2 tokens per KB for images

  // Text prompt tokens (approximately)
  const promptTokens = 200;

  // Total input tokens
  const inputTokens = imageTokens + promptTokens;

  // Calculate cost
  const inputCost = (inputTokens / 1_000_000) * 3; // $3 per million input tokens
  const outputCost = (outputTokens / 1_000_000) * 15; // $15 per million output tokens

  const totalCost = inputCost + outputCost;

  console.log('[ClaudeVision] Cost estimate:', {
    imageSizeKB: imageSizeKB.toFixed(2),
    imageTokens,
    inputTokens,
    outputTokens,
    totalCost: `$${totalCost.toFixed(4)}`,
  });

  return totalCost;
}

/**
 * Parse Claude API response to extract object recognition data
 *
 * @param responseText - Raw text response from Claude API
 * @returns Parsed object recognition data
 */
function parseObjectRecognitionData(responseText: string): ObjectRecognitionData {
  try {
    console.log('[ClaudeVision] Parsing object recognition response...');

    // Strategy 1: Try to extract JSON from code block
    let jsonText: string | null = null;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
      console.log('[ClaudeVision] Found JSON in code block');
    }

    // Strategy 2: Try to extract first complete JSON object
    if (!jsonText) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        console.log('[ClaudeVision] Found JSON object');
      }
    }

    if (!jsonText) {
      throw new Error('No JSON found in response');
    }

    // Remove comments from JSON
    jsonText = jsonText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Parse JSON
    const objectData = JSON.parse(jsonText);
    console.log('[ClaudeVision] JSON parsed successfully');

    // Validate required fields
    if (typeof objectData.objectName !== 'string' || !objectData.objectName.trim()) {
      throw new Error('Invalid or missing "objectName" field');
    }
    objectData.objectName = objectData.objectName.trim();

    if (typeof objectData.category !== 'string' || !objectData.category.trim()) {
      throw new Error('Invalid or missing "category" field');
    }
    objectData.category = objectData.category.trim();

    if (typeof objectData.description !== 'string' || !objectData.description.trim()) {
      throw new Error('Invalid or missing "description" field');
    }
    objectData.description = objectData.description.trim();

    // Validate optional string fields
    const stringFields = ['brand', 'model', 'color', 'material', 'priceRange', 'userPrompt'];
    stringFields.forEach((field) => {
      if (objectData[field] !== undefined && typeof objectData[field] === 'string') {
        objectData[field] = objectData[field].trim();
      }
    });

    // Validate additionalInfo object
    if (
      objectData.additionalInfo &&
      (typeof objectData.additionalInfo !== 'object' ||
        Array.isArray(objectData.additionalInfo))
    ) {
      console.warn('[ClaudeVision] Invalid additionalInfo field, using empty object');
      objectData.additionalInfo = {};
    }

    // Validate and normalize confidence
    if (typeof objectData.confidence !== 'number') {
      console.warn('[ClaudeVision] Invalid confidence field, attempting conversion');
      objectData.confidence = parseFloat(objectData.confidence);
    }
    if (isNaN(objectData.confidence)) {
      console.warn('[ClaudeVision] Cannot parse confidence, using default 0.5');
      objectData.confidence = 0.5;
    }
    // Clamp confidence to [0, 1]
    objectData.confidence = Math.max(0, Math.min(1, objectData.confidence));

    // Add timestamp
    objectData.timestamp = Date.now();

    // Store raw response for debugging
    objectData.rawResponse = responseText;

    console.log('[ClaudeVision] Parsed object data:', {
      objectName: objectData.objectName,
      category: objectData.category,
      confidence: objectData.confidence,
    });

    return objectData as ObjectRecognitionData;
  } catch (error) {
    console.error('[ClaudeVision] Failed to parse object recognition data:', error);
    console.error('[ClaudeVision] Raw response:', responseText);

    // Return fallback object data
    return {
      objectName: '解析失败',
      category: '未知',
      description: '无法识别该物品，请重试',
      confidence: 0,
      timestamp: Date.now(),
      rawResponse: responseText,
    };
  }
}

/**
 * Recognize object using Claude Vision API
 *
 * @param request - Object recognition request
 * @param apiKey - Anthropic API key
 * @returns Object recognition response
 */
export async function recognizeObjectWithClaude(
  request: ObjectRecognitionRequest,
  apiKey: string
): Promise<ObjectRecognitionResponse> {
  const startTime = Date.now();

  try {
    console.log('[ClaudeVision] Starting object recognition:', {
      userPrompt: request.userPrompt,
      mode: request.mode,
    });

    // Compress image if needed
    const compressedImage = await compressImage(request.imageBase64);

    // Build prompt
    const prompt = buildObjectRecognitionPrompt(request);

    // Extract image data
    let imageData = compressedImage;
    if (imageData.startsWith('data:image')) {
      imageData = imageData.split(',')[1] || imageData;
    }

    console.log('[ClaudeVision] Preparing API request...');
    console.log(
      '[ClaudeVision] Image size:',
      Math.round((imageData.length * 0.75) / 1024),
      'KB'
    );

    // Make API call to Claude Vision
    const response = await fetch(CLAUDE_API_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_API_CONFIG.apiVersion,
      },
      body: JSON.stringify({
        model: CLAUDE_API_CONFIG.model,
        max_tokens: CLAUDE_API_CONFIG.maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageData,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    // Check if response is OK
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Claude API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    // Parse API response
    const apiResponse = await response.json();
    console.log('[ClaudeVision] API response received:', {
      id: apiResponse.id,
      model: apiResponse.model,
      usage: apiResponse.usage,
    });

    // Extract text content from response
    const responseText = apiResponse.content?.[0]?.text || 'No response text';

    // Parse object recognition data
    const object = parseObjectRecognitionData(responseText);

    // Calculate cost
    const cost = estimateAPICost(
      compressedImage,
      apiResponse.usage?.output_tokens || 300
    );

    const duration = Date.now() - startTime;
    console.log(`[ClaudeVision] Object recognition completed in ${duration}ms`);
    console.log('[ClaudeVision] Recognized object:', {
      name: object.objectName,
      category: object.category,
      confidence: object.confidence,
    });

    return {
      object,
      success: true,
      cost,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ClaudeVision] Object recognition failed after ${duration}ms:`, error);

    return {
      object: {
        objectName: '识别失败',
        category: '未知',
        description: '无法识别该物品，请重试',
        confidence: 0,
        timestamp: Date.now(),
      },
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

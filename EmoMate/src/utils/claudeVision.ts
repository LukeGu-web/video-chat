/**
 * Claude Vision API Integration
 * Handles scene analysis using Claude 3.5 Sonnet Vision API
 */

import {
  SceneData,
  SceneAnalysisRequest,
  SceneAnalysisResponse,
  SceneTriggerType,
} from '../types/scene';

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
  // TODO: Implement image compression in Step 2.2
  // For now, return the original image
  console.log('[ClaudeVision] compressImage called, maxSizeKB:', maxSizeKB);
  return imageBase64;
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

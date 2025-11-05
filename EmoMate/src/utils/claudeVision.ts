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
  model: 'claude-3-5-sonnet-20241022',

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
 * @param request - Scene analysis request
 * @returns Prompt string for Claude API
 */
function buildAnalysisPrompt(request: SceneAnalysisRequest): string {
  const basePrompt = `请分析这张图片中的场景，提供以下信息（请用JSON格式返回）：

{
  "location": "场景位置/类型（如：咖啡馆、图书馆、办公室、户外等）",
  "objects": ["检测到的主要物体列表"],
  "details": {
    "特定物体的详细信息": "如书名、品牌等"
  },
  "atmosphere": "整体氛围描述",
  "lighting": "光线情况描述",
  "confidence": 0.0到1.0之间的置信度分数
}`;

  // Add specific question if keyword-triggered
  if (request.triggerType === SceneTriggerType.KEYWORD && request.userQuestion) {
    return `${basePrompt}

用户问题：${request.userQuestion}

请特别关注用户问题相关的物体，并在details中提供详细信息。`;
  }

  // Add context if there's a previous scene
  if (request.previousScene) {
    return `${basePrompt}

上一次场景分析：
- 位置：${request.previousScene.location}
- 物体：${request.previousScene.objects.join('、')}

如果场景基本相同，请保持一致的描述。`;
  }

  return basePrompt;
}

/**
 * Parse Claude API response to extract scene data
 *
 * @param responseText - Raw text response from Claude API
 * @returns Parsed scene data
 */
function parseSceneData(responseText: string): SceneData {
  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const sceneData = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!sceneData.location || !sceneData.objects || !sceneData.atmosphere) {
      throw new Error('Missing required fields in scene data');
    }

    // Add timestamp
    sceneData.timestamp = Date.now();

    // Store raw response for debugging
    sceneData.rawResponse = responseText;

    return sceneData as SceneData;
  } catch (error) {
    console.error('[ClaudeVision] Failed to parse scene data:', error);

    // Return fallback scene data
    return {
      location: '未知场景',
      objects: [],
      details: {},
      atmosphere: '无法分析',
      lighting: '未知',
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

    // TODO: Implement actual API call in Step 2.1
    // For now, return mock response
    console.log('[ClaudeVision] API call would be made here');
    console.log('[ClaudeVision] Prompt:', prompt);

    // Mock response for now
    const mockScene: SceneData = {
      location: '测试场景',
      objects: ['测试物体'],
      details: { test: true },
      atmosphere: '测试氛围',
      lighting: '测试光线',
      confidence: 0.5,
      timestamp: Date.now(),
      rawResponse: 'Mock response',
    };

    const duration = Date.now() - startTime;
    console.log(`[ClaudeVision] Analysis completed in ${duration}ms`);

    return {
      scene: mockScene,
      success: true,
      triggerType: request.triggerType,
      cost: 0.01, // Estimated cost, will calculate from actual API usage
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

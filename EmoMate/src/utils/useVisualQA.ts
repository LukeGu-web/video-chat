/**
 * Visual Question Answering Hook (Step 5.2)
 *
 * Detects visual keywords in user input and triggers scene analysis
 * to provide context-aware responses
 */

import { useCallback, useRef } from 'react';
import { detectVisualKeywords } from './useSceneUnderstanding';
import { analyzeSceneWithClaude } from './claudeVision';
import { SceneTriggerType } from '../types/scene';
import { useUserStore } from '../store/userStore';
import { getClaudeApiKey } from '../constants/ai';

export interface VisualQAConfig {
  /** Whether to enable visual QA (default: true) */
  enabled?: boolean;
  /** Callback when visual keyword detected */
  onKeywordDetected?: (keyword: string) => void;
  /** Callback when scene analysis starts */
  onAnalysisStart?: () => void;
  /** Callback when scene analysis completes */
  onAnalysisComplete?: () => void;
  /** Callback for errors */
  onError?: (error: string) => void;
}

export interface VisualQAReturn {
  /** Check if user input contains visual keywords and trigger analysis if needed */
  processUserInput: (
    inputText: string,
    imageBase64?: string
  ) => Promise<boolean>;
  /** Whether analysis is currently in progress */
  isAnalyzing: boolean;
}

/**
 * Hook for handling visual question answering
 *
 * When user asks visual questions (e.g., "这是什么书?", "周围有什么?"),
 * automatically triggers scene analysis to provide accurate answers
 *
 * @param config - Visual QA configuration
 * @returns Visual QA control methods
 */
export function useVisualQA(config: VisualQAConfig = {}): VisualQAReturn {
  const {
    enabled = true,
    onKeywordDetected,
    onAnalysisStart,
    onAnalysisComplete,
    onError,
  } = config;

  const { setCurrentScene } = useUserStore();
  const isAnalyzingRef = useRef(false);

  /**
   * Process user input and trigger scene analysis if visual keywords detected
   *
   * @param inputText - User input text
   * @param imageBase64 - Optional image for analysis (if not provided, analysis is skipped)
   * @returns true if visual keyword detected and analysis triggered
   */
  const processUserInput = useCallback(
    async (inputText: string, imageBase64?: string): Promise<boolean> => {
      if (!enabled || !inputText.trim()) {
        return false;
      }

      // Step 1: Detect visual keywords
      const detectedKeyword = detectVisualKeywords(inputText);

      if (!detectedKeyword) {
        // No visual keywords found
        return false;
      }

      // Step 2: Visual keyword detected
      console.log(
        `[VisualQA] 🎯 Visual keyword detected: "${detectedKeyword}" in "${inputText}"`
      );

      if (onKeywordDetected) {
        onKeywordDetected(detectedKeyword);
      }

      // Step 3: Check if image is available
      if (!imageBase64) {
        console.log(
          '[VisualQA] ⚠️ Visual keyword detected but no image available for analysis'
        );
        return true; // Keyword detected but cannot analyze
      }

      // Step 4: Trigger scene analysis
      if (isAnalyzingRef.current) {
        console.log('[VisualQA] ⏳ Analysis already in progress, skipping');
        return true;
      }

      try {
        isAnalyzingRef.current = true;

        if (onAnalysisStart) {
          onAnalysisStart();
        }

        console.log('[VisualQA] 🔍 Starting scene analysis for visual question');

        // Get API key
        const apiKey = getClaudeApiKey();
        if (!apiKey) {
          throw new Error('Claude API key not configured');
        }

        // Analyze scene with Claude Vision
        const response = await analyzeSceneWithClaude(
          {
            imageBase64,
            triggerType: SceneTriggerType.KEYWORD,
            userQuestion: inputText, // Pass user's question for context
          },
          apiKey
        );

        if (response.success && response.scene) {
          console.log(
            '[VisualQA] ✅ Scene analysis complete:',
            response.scene
          );

          // Update current scene in store
          setCurrentScene(response.scene);

          if (onAnalysisComplete) {
            onAnalysisComplete();
          }
        } else {
          console.log(
            '[VisualQA] ⚠️ Scene analysis failed:',
            response.error || 'Unknown error'
          );
          if (onError) {
            onError(response.error || '场景分析未返回数据');
          }
        }

        return true;
      } catch (error) {
        console.error('[VisualQA] ❌ Scene analysis error:', error);
        const errorMessage =
          error instanceof Error ? error.message : '场景分析失败';
        if (onError) {
          onError(errorMessage);
        }
        return true; // Keyword was detected even if analysis failed
      } finally {
        isAnalyzingRef.current = false;
      }
    },
    [
      enabled,
      setCurrentScene,
      onKeywordDetected,
      onAnalysisStart,
      onAnalysisComplete,
      onError,
    ]
  );

  return {
    processUserInput,
    isAnalyzing: isAnalyzingRef.current,
  };
}

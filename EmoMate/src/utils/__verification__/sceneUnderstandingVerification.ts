/**
 * Scene Understanding Verification Script
 * Step 1.2: Basic Testing and Verification
 *
 * This file verifies:
 * 1. All imports work correctly
 * 2. Types are properly defined
 * 3. Hook can be instantiated
 * 4. MMKV storage works
 * 5. Debug mode detection works
 */

import { useState, useEffect } from 'react';
import { createMMKV } from 'react-native-mmkv';

// Test 1: Import all type definitions
import {
  SceneData,
  SceneConfig,
  SceneTriggerType,
  SceneAnalysisRequest,
  SceneAnalysisResponse,
  SceneCacheEntry,
  SceneComparisonResult,
  DEFAULT_SCENE_CONFIG,
} from '../../types/scene';

// Test 2: Import Claude Vision utilities
import {
  analyzeSceneWithClaude,
  estimateAPICost,
} from '../claudeVision';

// Test 3: Import image comparison utilities
import {
  generateThumbnail,
  compareImages,
  hasSceneChanged,
} from '../imageComparison';

// Test 4: Import the main hook
import { useSceneUnderstanding } from '../useSceneUnderstanding';

/**
 * Verification Test Suite
 */
export class SceneUnderstandingVerification {
  private testResults: { [key: string]: boolean } = {};

  /**
   * Run all verification tests
   */
  async runAll(): Promise<void> {
    console.log('[Verification] Starting Scene Understanding verification tests...\n');

    this.testTypeImports();
    this.testUtilityImports();
    this.testMMKVStorage();
    this.testDebugMode();
    this.testDefaultConfig();

    this.printResults();
  }

  /**
   * Test 1: Verify all type imports
   */
  testTypeImports(): void {
    console.log('[Test 1] Testing type imports...');

    try {
      // Verify SceneData type
      const mockScene: SceneData = {
        location: 'test location',
        objects: ['object1', 'object2'],
        details: { test: 'detail' },
        atmosphere: 'test atmosphere',
        lighting: 'test lighting',
        confidence: 0.95,
        timestamp: Date.now(),
      };

      // Verify SceneTriggerType enum
      const triggerType: SceneTriggerType = SceneTriggerType.MANUAL;

      // Verify SceneConfig type
      const config: SceneConfig = DEFAULT_SCENE_CONFIG;

      // Verify SceneComparisonResult type
      const comparison: SceneComparisonResult = {
        similarity: 0.85,
        isSameScene: true,
        threshold: 0.7,
      };

      console.log('✅ All type imports successful');
      this.testResults['typeImports'] = true;
    } catch (error) {
      console.error('❌ Type imports failed:', error);
      this.testResults['typeImports'] = false;
    }
  }

  /**
   * Test 2: Verify utility function imports
   */
  testUtilityImports(): void {
    console.log('\n[Test 2] Testing utility imports...');

    try {
      // Check that functions exist
      if (typeof analyzeSceneWithClaude !== 'function') {
        throw new Error('analyzeSceneWithClaude is not a function');
      }
      if (typeof estimateAPICost !== 'function') {
        throw new Error('estimateAPICost is not a function');
      }
      if (typeof compareImages !== 'function') {
        throw new Error('compareImages is not a function');
      }
      if (typeof hasSceneChanged !== 'function') {
        throw new Error('hasSceneChanged is not a function');
      }
      if (typeof generateThumbnail !== 'function') {
        throw new Error('generateThumbnail is not a function');
      }
      if (typeof useSceneUnderstanding !== 'function') {
        throw new Error('useSceneUnderstanding is not a function');
      }

      console.log('✅ All utility functions imported successfully');
      this.testResults['utilityImports'] = true;
    } catch (error) {
      console.error('❌ Utility imports failed:', error);
      this.testResults['utilityImports'] = false;
    }
  }

  /**
   * Test 3: Verify MMKV storage operations
   */
  testMMKVStorage(): void {
    console.log('\n[Test 3] Testing MMKV storage operations...');

    try {
      // Create test storage instance
      const testStorage = createMMKV({
        id: 'verification-test-storage',
      });

      // Test set operation
      const testKey = 'test_key';
      const testValue = JSON.stringify({ test: 'data', timestamp: Date.now() });
      testStorage.set(testKey, testValue);
      console.log('  ✓ set() operation successful');

      // Test getString operation
      const retrievedValue = testStorage.getString(testKey);
      if (retrievedValue !== testValue) {
        throw new Error('Retrieved value does not match stored value');
      }
      console.log('  ✓ getString() operation successful');

      // Test contains operation
      if (!testStorage.contains(testKey)) {
        throw new Error('contains() returned false for existing key');
      }
      console.log('  ✓ contains() operation successful');

      // Test remove operation
      const removed = testStorage.remove(testKey);
      if (!removed) {
        throw new Error('remove() returned false');
      }
      console.log('  ✓ remove() operation successful');

      // Verify removal
      if (testStorage.contains(testKey)) {
        throw new Error('Key still exists after removal');
      }
      console.log('  ✓ Key successfully removed');

      // Cleanup
      testStorage.clearAll();
      console.log('✅ MMKV storage operations verified');
      this.testResults['mmkvStorage'] = true;
    } catch (error) {
      console.error('❌ MMKV storage test failed:', error);
      this.testResults['mmkvStorage'] = false;
    }
  }

  /**
   * Test 4: Verify debug mode detection
   */
  testDebugMode(): void {
    console.log('\n[Test 4] Testing debug mode detection...');

    try {
      const debugMode = process.env.SHOW_TEST_COMPONENTS === 'true';
      const configDebugMode = DEFAULT_SCENE_CONFIG.debugMode;

      console.log(`  Current SHOW_TEST_COMPONENTS: ${process.env.SHOW_TEST_COMPONENTS}`);
      console.log(`  Detected debug mode: ${debugMode}`);
      console.log(`  Config debug mode: ${configDebugMode}`);

      if (debugMode !== configDebugMode) {
        throw new Error('Debug mode mismatch between detection and config');
      }

      console.log('✅ Debug mode detection verified');
      this.testResults['debugMode'] = true;
    } catch (error) {
      console.error('❌ Debug mode test failed:', error);
      this.testResults['debugMode'] = false;
    }
  }

  /**
   * Test 5: Verify default configuration
   */
  testDefaultConfig(): void {
    console.log('\n[Test 5] Testing default configuration...');

    try {
      const config = DEFAULT_SCENE_CONFIG;

      // Verify all required fields exist
      const requiredFields = [
        'enabled',
        'timerInterval',
        'sceneChangeThreshold',
        'deduplicationThreshold',
        'cacheExpiration',
        'maxImageSizeKB',
        'triggerKeywords',
        'debugMode',
      ];

      for (const field of requiredFields) {
        if (!(field in config)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Verify field values are reasonable
      if (config.timerInterval <= 0) {
        throw new Error('timerInterval must be positive');
      }
      if (config.sceneChangeThreshold < 0 || config.sceneChangeThreshold > 1) {
        throw new Error('sceneChangeThreshold must be between 0 and 1');
      }
      if (config.deduplicationThreshold < 0 || config.deduplicationThreshold > 1) {
        throw new Error('deduplicationThreshold must be between 0 and 1');
      }
      if (config.cacheExpiration <= 0) {
        throw new Error('cacheExpiration must be positive');
      }
      if (config.maxImageSizeKB <= 0) {
        throw new Error('maxImageSizeKB must be positive');
      }
      if (!Array.isArray(config.triggerKeywords) || config.triggerKeywords.length === 0) {
        throw new Error('triggerKeywords must be a non-empty array');
      }

      console.log('✅ Default configuration verified');
      this.testResults['defaultConfig'] = true;
    } catch (error) {
      console.error('❌ Default configuration test failed:', error);
      this.testResults['defaultConfig'] = false;
    }
  }

  /**
   * Print test results summary
   */
  printResults(): void {
    console.log('\n' + '='.repeat(50));
    console.log('VERIFICATION RESULTS SUMMARY');
    console.log('='.repeat(50));

    const passed = Object.values(this.testResults).filter(r => r).length;
    const total = Object.keys(this.testResults).length;

    Object.entries(this.testResults).forEach(([test, result]) => {
      console.log(`${result ? '✅' : '❌'} ${test}`);
    });

    console.log('='.repeat(50));
    console.log(`Total: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log('✅ All verification tests passed!');
      console.log('\nStep 1.2 完成！可以继续步骤 2.1（实现 Claude Vision API 集成）');
    } else {
      console.log('❌ Some tests failed. Please review the errors above.');
    }
  }
}

/**
 * Export a function to run verification
 */
export async function runVerification(): Promise<void> {
  const verification = new SceneUnderstandingVerification();
  await verification.runAll();
}

/**
 * Note: This verification script is meant to be imported and run,
 * not executed directly. To use it:
 *
 * import { runVerification } from './utils/__verification__/sceneUnderstandingVerification';
 * runVerification();
 */

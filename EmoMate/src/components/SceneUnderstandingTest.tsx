/**
 * Scene Understanding Test Component
 * Step 1.2: Hook Instantiation Verification
 *
 * This component verifies that the useSceneUnderstanding hook can be properly instantiated
 * and that all its methods and state are accessible.
 *
 * Usage: Add this component to a test screen when SHOW_TEST_COMPONENTS is enabled.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSceneUnderstanding } from '../utils/useSceneUnderstanding';
import { runVerification } from '../utils/__verification__/sceneUnderstandingVerification';

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'pending';
  message?: string;
}

export function SceneUnderstandingTest() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [verificationRun, setVerificationRun] = useState(false);

  // Test: Instantiate the hook with a dummy API key
  const TEST_API_KEY = 'test-api-key-for-verification';
  const sceneHook = useSceneUnderstanding(TEST_API_KEY, {
    enabled: false, // Disable for testing to avoid unwanted API calls
    debugMode: true,
  });

  useEffect(() => {
    runTests();
  }, []);

  const runTests = () => {
    const results: TestResult[] = [];

    // Test 1: Hook instantiation
    try {
      if (sceneHook) {
        results.push({
          test: 'Hook Instantiation',
          status: 'pass',
          message: 'useSceneUnderstanding hook instantiated successfully',
        });
      }
    } catch (error) {
      results.push({
        test: 'Hook Instantiation',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: State properties
    try {
      const requiredState = [
        'currentScene',
        'isAnalyzing',
        'error',
        'lastTriggerType',
        'lastAnalysisTime',
        'totalAPICalls',
        'totalCost',
        'debugInfo',
      ];

      const missingState = requiredState.filter(key => !(key in sceneHook));

      if (missingState.length === 0) {
        results.push({
          test: 'State Properties',
          status: 'pass',
          message: `All ${requiredState.length} state properties present`,
        });
      } else {
        results.push({
          test: 'State Properties',
          status: 'fail',
          message: `Missing properties: ${missingState.join(', ')}`,
        });
      }
    } catch (error) {
      results.push({
        test: 'State Properties',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 3: Method properties
    try {
      const requiredMethods = [
        'analyzeScene',
        'checkSceneChange',
        'clearCache',
        'updateConfig',
        'getConfig',
        'resetStats',
      ];

      const missingMethods = requiredMethods.filter(
        key => !(key in sceneHook) || typeof (sceneHook as any)[key] !== 'function'
      );

      if (missingMethods.length === 0) {
        results.push({
          test: 'Method Properties',
          status: 'pass',
          message: `All ${requiredMethods.length} methods present`,
        });
      } else {
        results.push({
          test: 'Method Properties',
          status: 'fail',
          message: `Missing methods: ${missingMethods.join(', ')}`,
        });
      }
    } catch (error) {
      results.push({
        test: 'Method Properties',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 4: Initial state values
    try {
      const checks: string[] = [];

      if (sceneHook.currentScene !== null) {
        checks.push('currentScene should be null initially');
      }
      if (sceneHook.isAnalyzing !== false) {
        checks.push('isAnalyzing should be false initially');
      }
      if (sceneHook.error !== null) {
        checks.push('error should be null initially');
      }
      if (sceneHook.totalAPICalls !== 0) {
        checks.push('totalAPICalls should be 0 initially');
      }
      if (sceneHook.totalCost !== 0) {
        checks.push('totalCost should be 0 initially');
      }

      if (checks.length === 0) {
        results.push({
          test: 'Initial State Values',
          status: 'pass',
          message: 'All initial state values correct',
        });
      } else {
        results.push({
          test: 'Initial State Values',
          status: 'fail',
          message: checks.join('; '),
        });
      }
    } catch (error) {
      results.push({
        test: 'Initial State Values',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 5: Config access
    try {
      const config = sceneHook.getConfig();

      if (config && typeof config === 'object') {
        results.push({
          test: 'Config Access',
          status: 'pass',
          message: `Config retrieved: enabled=${config.enabled}, debugMode=${config.debugMode}`,
        });
      } else {
        results.push({
          test: 'Config Access',
          status: 'fail',
          message: 'getConfig() did not return valid config object',
        });
      }
    } catch (error) {
      results.push({
        test: 'Config Access',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 6: Method calls (non-async)
    try {
      // Test clearCache (should not throw)
      sceneHook.clearCache();

      // Test resetStats (should not throw)
      sceneHook.resetStats();

      // Test updateConfig (should not throw)
      sceneHook.updateConfig({ debugMode: true });

      results.push({
        test: 'Synchronous Methods',
        status: 'pass',
        message: 'clearCache, resetStats, updateConfig executed without errors',
      });
    } catch (error) {
      results.push({
        test: 'Synchronous Methods',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    setTestResults(results);
  };

  const runFullVerification = async () => {
    console.log('\n🔍 Running full verification suite...\n');
    await runVerification();
    setVerificationRun(true);
  };

  const passedTests = testResults.filter(r => r.status === 'pass').length;
  const totalTests = testResults.length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scene Understanding Test</Text>
        <Text style={styles.subtitle}>Step 1.2: Hook Instantiation Verification</Text>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Tests Passed: {passedTests}/{totalTests}
        </Text>
        {passedTests === totalTests && (
          <Text style={styles.successText}>✅ All tests passed!</Text>
        )}
      </View>

      <View style={styles.testList}>
        {testResults.map((result, index) => (
          <View
            key={index}
            style={[
              styles.testItem,
              result.status === 'pass' ? styles.testPass : styles.testFail,
            ]}
          >
            <Text style={styles.testName}>
              {result.status === 'pass' ? '✅' : '❌'} {result.test}
            </Text>
            {result.message && (
              <Text style={styles.testMessage}>{result.message}</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={runFullVerification}
        >
          <Text style={styles.buttonText}>
            {verificationRun ? '✅ Verification Complete (check console)' : 'Run Full Verification'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={runTests}
        >
          <Text style={styles.buttonText}>Re-run Tests</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>Debug Info:</Text>
        <Text style={styles.infoText}>API Calls: {sceneHook.totalAPICalls}</Text>
        <Text style={styles.infoText}>Total Cost: ${sceneHook.totalCost.toFixed(4)}</Text>
        <Text style={styles.infoText}>
          Debug Mode: {sceneHook.getConfig().debugMode ? 'Enabled' : 'Disabled'}
        </Text>
        <Text style={styles.infoText}>
          Feature Enabled: {sceneHook.getConfig().enabled ? 'Yes' : 'No'}
        </Text>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Note: This component is for development testing only.{'\n'}
          Check console logs for detailed verification output.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4a90e2',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#e0e0e0',
    marginTop: 5,
  },
  summary: {
    backgroundColor: '#fff',
    padding: 15,
    margin: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  successText: {
    fontSize: 16,
    color: '#4caf50',
    marginTop: 5,
  },
  testList: {
    padding: 10,
  },
  testItem: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  testPass: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  testFail: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
  },
  testName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  testMessage: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    padding: 10,
  },
  button: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  info: {
    backgroundColor: '#fff',
    padding: 15,
    margin: 10,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  note: {
    backgroundColor: '#fff3cd',
    padding: 15,
    margin: 10,
    borderRadius: 8,
  },
  noteText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
});

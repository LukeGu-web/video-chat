/**
 * Motion Mapper Usage Examples
 *
 * This file demonstrates how to use the advanced motion mapping system
 * for context-aware Hiyori Live2D character animations.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { EmotionAwareCharacter } from '../components/EmotionAwareCharacter';
import {
  selectMotionFromText,
  analyzeConversationContext,
  getAvailableMotions,
  getMotionDuration,
  isTemporaryMotion
} from '../utils/motionMapper';
import { EmotionType } from '../types/emotion';

/**
 * Example 1: Basic Motion Mapper Demo
 * Shows how the system selects motions based on text input
 */
export const BasicMotionMapperDemo: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionType>('neutral');
  const [motionResult, setMotionResult] = useState<any>(null);

  const testMotionSelection = () => {
    const selection = selectMotionFromText(inputText, selectedEmotion);
    setMotionResult(selection);
  };

  const testCases = [
    { text: '你好呀！', emotion: 'happy' as EmotionType, expected: 'Wave' },
    { text: '太好了！我们成功了！', emotion: 'happy' as EmotionType, expected: 'Dance' },
    { text: '嗯…让我想想', emotion: 'neutral' as EmotionType, expected: 'Thinking' },
    { text: '哈哈哈，好好笑！', emotion: 'happy' as EmotionType, expected: 'Laugh' },
    { text: '没事吧？要不要说说', emotion: 'sad' as EmotionType, expected: 'Sleepy' },
  ];

  return (
    <ScrollView className="flex-1 p-4 bg-gray-100">
      <Text className="text-2xl font-bold mb-4">Motion Mapper Demo</Text>

      {/* Input Section */}
      <View className="bg-white rounded-lg p-4 mb-4 shadow">
        <Text className="text-lg font-semibold mb-2">Test Input</Text>

        <TextInput
          className="border border-gray-300 rounded px-3 py-2 mb-3"
          placeholder="输入测试文本..."
          value={inputText}
          onChangeText={setInputText}
        />

        <Text className="text-sm text-gray-600 mb-2">Select Emotion:</Text>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {(['neutral', 'happy', 'sad', 'surprised', 'angry'] as EmotionType[]).map(emotion => (
            <TouchableOpacity
              key={emotion}
              className={`px-3 py-2 rounded ${
                selectedEmotion === emotion ? 'bg-blue-500' : 'bg-gray-200'
              }`}
              onPress={() => setSelectedEmotion(emotion)}
            >
              <Text className={selectedEmotion === emotion ? 'text-white' : 'text-gray-700'}>
                {emotion}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          className="bg-green-500 rounded px-4 py-3"
          onPress={testMotionSelection}
        >
          <Text className="text-white text-center font-semibold">Test Motion Selection</Text>
        </TouchableOpacity>
      </View>

      {/* Result Section */}
      {motionResult && (
        <View className="bg-white rounded-lg p-4 mb-4 shadow">
          <Text className="text-lg font-semibold mb-3">Selection Result</Text>

          <View className="space-y-2">
            <View className="flex-row">
              <Text className="text-gray-600 w-24">Motion:</Text>
              <Text className="text-green-600 font-bold">{motionResult.motion}</Text>
            </View>

            <View className="flex-row">
              <Text className="text-gray-600 w-24">Priority:</Text>
              <Text className="text-blue-600">{motionResult.priority}</Text>
            </View>

            <View className="flex-row">
              <Text className="text-gray-600 w-24">Reason:</Text>
              <Text className="text-gray-800 flex-1">{motionResult.reason}</Text>
            </View>

            {motionResult.duration && (
              <View className="flex-row">
                <Text className="text-gray-600 w-24">Duration:</Text>
                <Text className="text-gray-800">{motionResult.duration}ms</Text>
              </View>
            )}

            <View className="flex-row">
              <Text className="text-gray-600 w-24">Return to Idle:</Text>
              <Text className="text-gray-800">
                {motionResult.returnToIdle ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Test Cases Section */}
      <View className="bg-white rounded-lg p-4 mb-4 shadow">
        <Text className="text-lg font-semibold mb-3">Quick Test Cases</Text>

        {testCases.map((testCase, index) => (
          <TouchableOpacity
            key={index}
            className="border-b border-gray-200 py-3"
            onPress={() => {
              setInputText(testCase.text);
              setSelectedEmotion(testCase.emotion);
              const selection = selectMotionFromText(testCase.text, testCase.emotion);
              setMotionResult(selection);
            }}
          >
            <Text className="text-gray-800 mb-1">{testCase.text}</Text>
            <View className="flex-row items-center">
              <Text className="text-gray-500 text-sm">Emotion: {testCase.emotion}</Text>
              <Text className="text-gray-400 mx-2">→</Text>
              <Text className="text-blue-600 text-sm">Expected: {testCase.expected}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Available Motions */}
      <View className="bg-white rounded-lg p-4 shadow">
        <Text className="text-lg font-semibold mb-3">Available Motions</Text>

        {getAvailableMotions().map(motion => (
          <View key={motion} className="flex-row items-center justify-between py-2 border-b border-gray-100">
            <Text className="text-gray-800">{motion}</Text>
            <View className="flex-row items-center">
              <Text className="text-gray-500 text-sm mr-3">
                {getMotionDuration(motion)}ms
              </Text>
              {isTemporaryMotion(motion) && (
                <View className="bg-yellow-100 px-2 py-1 rounded">
                  <Text className="text-yellow-700 text-xs">Temporary</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

/**
 * Example 2: Interactive Character with Text Input
 * Live preview of how character reacts to different inputs
 */
export const InteractiveCharacterDemo: React.FC = () => {
  const [currentText, setCurrentText] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [emotion, setEmotion] = useState<EmotionType>('neutral');

  const handleSend = () => {
    setDisplayText(currentText);
  };

  const presetMessages = [
    { text: '你好！', emotion: 'happy' as EmotionType },
    { text: '我考试通过了！', emotion: 'happy' as EmotionType },
    { text: '让我想想...', emotion: 'neutral' as EmotionType },
    { text: '哈哈哈，太有趣了！', emotion: 'happy' as EmotionType },
    { text: '我有点难过', emotion: 'sad' as EmotionType },
    { text: '真的吗？', emotion: 'surprised' as EmotionType },
  ];

  return (
    <View className="flex-1 bg-gray-100">
      {/* Character Display */}
      <View className="items-center justify-center p-4 bg-white">
        <EmotionAwareCharacter
          size={300}
          currentText={displayText}
          enableEmotionMapping={true}
        />
      </View>

      {/* Control Panel */}
      <View className="p-4">
        <Text className="text-lg font-semibold mb-3">Send Message to Character</Text>

        <TextInput
          className="bg-white border border-gray-300 rounded px-3 py-2 mb-3"
          placeholder="输入消息..."
          value={currentText}
          onChangeText={setCurrentText}
          multiline
        />

        <View className="flex-row items-center mb-3">
          <Text className="text-gray-600 mr-3">Emotion:</Text>
          <View className="flex-row flex-wrap gap-2 flex-1">
            {(['neutral', 'happy', 'sad', 'surprised'] as EmotionType[]).map(e => (
              <TouchableOpacity
                key={e}
                className={`px-3 py-1 rounded ${
                  emotion === e ? 'bg-blue-500' : 'bg-gray-200'
                }`}
                onPress={() => setEmotion(e)}
              >
                <Text className={`text-sm ${emotion === e ? 'text-white' : 'text-gray-700'}`}>
                  {e}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          className="bg-blue-500 rounded px-4 py-3 mb-4"
          onPress={handleSend}
        >
          <Text className="text-white text-center font-semibold">Send to Character</Text>
        </TouchableOpacity>

        {/* Preset Messages */}
        <Text className="text-sm text-gray-600 mb-2">Quick Presets:</Text>
        <View className="flex-row flex-wrap gap-2">
          {presetMessages.map((preset, index) => (
            <TouchableOpacity
              key={index}
              className="bg-gray-200 rounded px-3 py-2"
              onPress={() => {
                setCurrentText(preset.text);
                setEmotion(preset.emotion);
                setDisplayText(preset.text);
              }}
            >
              <Text className="text-gray-700 text-sm">{preset.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

/**
 * Example 3: Context Analysis Visualization
 * Shows how the system analyzes conversation context
 */
export const ContextAnalysisDemo: React.FC = () => {
  const [inputText, setInputText] = useState('你好呀！很高兴见到你');
  const [emotion, setEmotion] = useState<EmotionType>('happy');
  const [context, setContext] = useState<any>(null);

  const analyzeText = () => {
    const result = analyzeConversationContext(inputText, emotion, false, false);
    setContext(result);
  };

  React.useEffect(() => {
    analyzeText();
  }, [inputText, emotion]);

  const contextFlags = [
    { key: 'isGreeting', label: 'Greeting', color: 'bg-green-500' },
    { key: 'isQuestion', label: 'Question', color: 'bg-blue-500' },
    { key: 'isEncouragement', label: 'Encouragement', color: 'bg-yellow-500' },
    { key: 'isCelebration', label: 'Celebration', color: 'bg-purple-500' },
    { key: 'isEmpathy', label: 'Empathy', color: 'bg-pink-500' },
  ];

  return (
    <ScrollView className="flex-1 p-4 bg-gray-100">
      <Text className="text-2xl font-bold mb-4">Context Analysis</Text>

      <View className="bg-white rounded-lg p-4 mb-4 shadow">
        <Text className="text-lg font-semibold mb-3">Input Text</Text>

        <TextInput
          className="border border-gray-300 rounded px-3 py-2 mb-3"
          placeholder="输入文本进行分析..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <View className="flex-row items-center">
          <Text className="text-gray-600 mr-3">Emotion:</Text>
          {(['neutral', 'happy', 'sad', 'surprised'] as EmotionType[]).map(e => (
            <TouchableOpacity
              key={e}
              className={`px-2 py-1 rounded mr-2 ${
                emotion === e ? 'bg-blue-500' : 'bg-gray-200'
              }`}
              onPress={() => setEmotion(e)}
            >
              <Text className={`text-xs ${emotion === e ? 'text-white' : 'text-gray-700'}`}>
                {e}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {context && (
        <View className="bg-white rounded-lg p-4 mb-4 shadow">
          <Text className="text-lg font-semibold mb-3">Detected Context</Text>

          <View className="flex-row flex-wrap gap-2 mb-4">
            {contextFlags.map(flag => (
              context[flag.key] && (
                <View key={flag.key} className={`${flag.color} px-3 py-1 rounded`}>
                  <Text className="text-white text-sm">{flag.label}</Text>
                </View>
              )
            ))}
            {!contextFlags.some(f => context[f.key]) && (
              <View className="bg-gray-300 px-3 py-1 rounded">
                <Text className="text-gray-600 text-sm">No special context detected</Text>
              </View>
            )}
          </View>

          <View className="border-t border-gray-200 pt-3">
            <Text className="text-sm text-gray-600 mb-2">Raw Context Object:</Text>
            <View className="bg-gray-50 p-3 rounded">
              <Text className="text-xs font-mono text-gray-700">
                {JSON.stringify(context, null, 2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Test Examples */}
      <View className="bg-white rounded-lg p-4 shadow">
        <Text className="text-lg font-semibold mb-3">Example Texts</Text>

        {[
          { text: '你好！很高兴见到你', contexts: ['Greeting'] },
          { text: '太棒了！我们成功了！', contexts: ['Celebration', 'Encouragement'] },
          { text: '你觉得怎么样？', contexts: ['Question'] },
          { text: '没事吧？要不要说说', contexts: ['Empathy', 'Question'] },
          { text: '哈哈哈，好好笑！', contexts: ['None (but will select Laugh motion)'] },
        ].map((example, index) => (
          <TouchableOpacity
            key={index}
            className="border-b border-gray-200 py-3"
            onPress={() => setInputText(example.text)}
          >
            <Text className="text-gray-800 mb-1">{example.text}</Text>
            <Text className="text-gray-500 text-sm">
              Contexts: {example.contexts.join(', ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

export default {
  BasicMotionMapperDemo,
  InteractiveCharacterDemo,
  ContextAnalysisDemo
};

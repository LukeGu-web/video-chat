import { useEffect, useRef } from 'react';
import { ChatMessage } from '../store';

/**
 * AI message type (simplified)
 */
interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * useVoiceConversationManager Hook Parameters
 */
interface VoiceConversationManagerParams {
  /** Current listening state */
  isListening: boolean;
  /** Current transcript text */
  transcript: string;
  /** AI messages array */
  messages: AIMessage[];
  /** Function to start conversation with transcript */
  startConversation: (text: string) => void;
  /** Function to clear transcript */
  clearTranscript: () => void;
  /** Function to add message to chat history */
  addChatMessage: (message: ChatMessage) => void;
  /** Function to generate unique message ID */
  generateMessageId: () => string;
}

/**
 * useVoiceConversationManager Hook
 * Manages voice recognition to AI conversation flow
 * Consolidates 2 useEffects into a single hook
 */
export const useVoiceConversationManager = ({
  isListening,
  transcript,
  messages,
  startConversation,
  clearTranscript,
  addChatMessage,
  generateMessageId,
}: VoiceConversationManagerParams) => {
  // Track previous transcript to prevent unnecessary conversation starts
  const prevTranscriptRef = useRef<string>('');

  // 1. Listen for voice recognition completion and start conversation
  useEffect(() => {
    // Only trigger on real state transitions (avoid re-execution due to function reference changes)
    if (!isListening && transcript && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      startConversation(transcript);
      clearTranscript();
    }
  }, [isListening, transcript]);

  // Track processed AI messages to avoid duplicates
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // 2. Listen for AI messages and add to chat history
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      // Use unique ID instead of content and timestamp comparison to avoid traversing entire history
      const messageId = `${lastMessage.content}_${lastMessage.timestamp}`;

      if (
        lastMessage.role === 'assistant' &&
        !processedMessageIdsRef.current.has(messageId)
      ) {
        processedMessageIdsRef.current.add(messageId);

        const aiMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          isVoiceMessage: true,
        };
        addChatMessage(aiMessage);
      }
    }
  }, [messages]); // Only depend on messages to avoid unnecessary re-execution
};

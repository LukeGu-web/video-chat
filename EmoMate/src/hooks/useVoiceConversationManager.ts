import { useEffect, useRef } from 'react';

/**
 * useVoiceConversationManager Hook Parameters
 */
interface VoiceConversationManagerParams {
  /** Current listening state */
  isListening: boolean;
  /** Current transcript text */
  transcript: string;
  /** Function to start conversation with transcript */
  startConversation: (text: string) => void;
  /** Function to clear transcript */
  clearTranscript: () => void;
}

/**
 * useVoiceConversationManager Hook
 * Manages voice recognition to AI conversation flow
 * Note: Message persistence is now handled by useChatAI with isVoiceMessage flag
 */
export const useVoiceConversationManager = ({
  isListening,
  transcript,
  startConversation,
  clearTranscript,
}: VoiceConversationManagerParams) => {
  // Track previous transcript to prevent unnecessary conversation starts
  const prevTranscriptRef = useRef<string>('');

  // Listen for voice recognition completion and start conversation
  useEffect(() => {
    // Only trigger on real state transitions (avoid re-execution due to function reference changes)
    if (!isListening && transcript && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      startConversation(transcript);
      clearTranscript();
    }
  }, [isListening, transcript, startConversation, clearTranscript]);
};

import type { MetaFunction } from '@remix-run/node';
import { ClientOnly } from 'remix-utils/client-only';
import { useRef } from 'react';
import ShizukuLive2D, {
  type ShizukuLive2DRef,
} from '~/components/ShizukuLive2D';

export const meta: MetaFunction = () => {
  return [
    { title: 'Shizuku Character App' },
    { name: 'description', content: 'Live2D Shizuku Character Display' },
  ];
};

export default function Index() {
  const shizukuRef = useRef<ShizukuLive2DRef>(null);

  const motions = [
    { name: 'Idle', label: '🌸 Idle', description: 'Default peaceful state' },
    { name: 'Tap', label: '😊 Happy', description: 'Cheerful tap response' },
    {
      name: 'FlickUp',
      label: '😮 Surprised',
      description: 'Surprised reaction',
    },
    {
      name: 'Flick3',
      label: '😳 Shy',
      description: 'Shy/embarrassed response',
    },
  ];

  const expressions = [
    { param: 'PARAM_TERE', label: '😊 Blush', min: 0, max: 1, step: 0.1 },
    {
      param: 'PARAM_EYE_BALL_X',
      label: '👁️ Eye X',
      min: -1,
      max: 1,
      step: 0.1,
    },
    {
      param: 'PARAM_EYE_BALL_Y',
      label: '👁️ Eye Y',
      min: -1,
      max: 1,
      step: 0.1,
    },
    { param: 'PARAM_ANGLE_X', label: '🎭 Head X', min: -30, max: 30, step: 1 },
    { param: 'PARAM_ANGLE_Y', label: '🎭 Head Y', min: -30, max: 30, step: 1 },
  ];

  return (
    <div className='flex h-screen'>
      {/* Character Display */}
      <div className='flex items-center justify-center flex-1 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800'>
        <div className='flex flex-col items-center gap-4'>
          <ClientOnly
            fallback={
              <div className='flex items-center justify-center bg-gray-200 rounded-lg w-96 h-96 dark:bg-gray-700'>
                Loading Shizuku...
              </div>
            }
          >
            {() => (
              <ShizukuLive2D
                ref={shizukuRef}
                width={400}
                height={600}
                className='rounded-lg'
              />
            )}
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}

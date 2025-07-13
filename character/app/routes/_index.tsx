import type { MetaFunction } from '@remix-run/node';
import { ClientOnly } from 'remix-utils/client-only';
import { useRef } from 'react';
import HiyoriLive2D, {
  type HiyoriLive2DRef,
} from '~/components/HiyoriLive2D';

export const meta: MetaFunction = () => {
  return [
    { title: 'Hiyori Character App' },
    { name: 'description', content: 'Live2D Hiyori Character Display' },
  ];
};

export default function Index() {
  const hiyoriRef = useRef<HiyoriLive2DRef>(null);

  return (
    <div className='flex h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800'>
      <div className='flex flex-col items-center gap-4'>
        <ClientOnly
          fallback={
            <div className='w-96 h-96 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center'>
              Loading Hiyori...
            </div>
          }
        >
          {() => (
            <HiyoriLive2D
              ref={hiyoriRef}
              width={500}
              height={700}
              className='rounded-lg'
            />
          )}
        </ClientOnly>
      </div>
    </div>
  );
}

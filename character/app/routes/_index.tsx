import type { MetaFunction } from '@remix-run/node';
import { ClientOnly } from 'remix-utils/client-only';
import { useRef } from 'react';
import VRMAvatar, { type VRMAvatarRef } from '~/components/VRMAvatar';

export const meta: MetaFunction = () => {
  return [
    { title: 'Character App' },
    { name: 'description', content: 'VRM Character Display' },
  ];
};

export default function Index() {
  const avatarRef = useRef<VRMAvatarRef>(null);

  return (
    <div className='flex h-screen items-center justify-center'
         style={{ background: 'transparent' }}>
      <ClientOnly
        fallback={
          <div className='w-96 h-96 flex items-center justify-center text-gray-400'>
            Loading...
          </div>
        }
      >
        {() => (
          <VRMAvatar
            ref={avatarRef}
            modelPath='/assets/vrm/girl_c.vrm?v=2'
            width={500}
            height={700}
          />
        )}
      </ClientOnly>
    </div>
  );
}

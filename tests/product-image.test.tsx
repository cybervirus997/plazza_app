import { act } from 'react';
import { createRoot } from 'test-renderer';

import { ProductImage } from '../src/components/ProductImage';

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { Image: (props: object) => React.createElement('ProductArtwork', props) };
});

test('missing artwork and decode errors keep the local fallback; changing artwork allows another image', async () => {
  const root = createRoot();
  try {
    await act(async () => { root.render(<ProductImage />); });
    expect(root.container.queryAll((node) => node.type === 'ProductArtwork')).toHaveLength(0);
    expect(root.container.queryAll((node) => node.type === 'Text' && node.children.includes('+')).length).toBeGreaterThan(0);
    await act(async () => { root.render(<ProductImage imageKey="medicine" />); });
    const artwork = root.container.queryAll((node) => node.type === 'ProductArtwork')[0];
    const onError: unknown = artwork.props.onError;
    expect(typeof onError).toBe('function');
    await act(async () => { if (typeof onError === 'function') onError(); });
    expect(root.container.queryAll((node) => node.type === 'ProductArtwork')).toHaveLength(0);
    await act(async () => { root.render(<ProductImage imageKey="baby" />); });
    expect(root.container.queryAll((node) => node.type === 'ProductArtwork')).toHaveLength(1);
  } finally { await act(async () => { root.unmount(); }); }
});

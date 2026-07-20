import { chooseQualityProfile } from './detectTier';

describe('adaptive quality detection', () => {
  it('starts constrained mobile hardware on low with a medium ceiling', () => {
    expect(chooseQualityProfile({
      deviceMemory: 2,
      hardwareConcurrency: 4,
      devicePixelRatio: 3,
      compactViewport: true,
      mobilePointer: true,
    })).toEqual({ initialTier: 'low', ceiling: 'medium' });
  });

  it('starts typical mobile and compact devices on medium', () => {
    expect(chooseQualityProfile({
      deviceMemory: 8,
      hardwareConcurrency: 8,
      devicePixelRatio: 2,
      compactViewport: true,
      mobilePointer: true,
    })).toEqual({ initialTier: 'medium', ceiling: 'high' });
  });

  it('allows capable desktop hardware to scale from high to ultra', () => {
    expect(chooseQualityProfile({
      deviceMemory: 16,
      hardwareConcurrency: 16,
      devicePixelRatio: 1.5,
      compactViewport: false,
      mobilePointer: false,
    })).toEqual({ initialTier: 'high', ceiling: 'ultra' });
  });
});

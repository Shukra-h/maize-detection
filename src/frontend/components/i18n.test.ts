import { describe, expect, it } from 'vitest';

import {
  getDiseaseDetails,
  getFallbackGuidance,
  translateClassLabel,
  translateGuidance,
} from './i18n';

describe('i18n disease mapping', () => {
  it('maps backend class names to user-facing English labels', () => {
    expect(translateClassLabel('Corn_(maize)___healthy', 'en')).toBe('Healthy Leaf');
    expect(translateClassLabel('Corn_(maize)___Common_rust_', 'en')).toBe('Common Rust');
    expect(translateClassLabel('Corn_(maize)___Northern_Leaf_Blight', 'en')).toBe(
      'Northern Leaf Blight',
    );
    expect(translateClassLabel('Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'en')).toBe(
      'Gray Leaf Spot',
    );
    expect(translateClassLabel('unknown_unclassified', 'en')).toBe('Image Rejected');
  });

  it('returns localized disease details for supported languages', () => {
    expect(getDiseaseDetails('Corn_(maize)___Common_rust_', 'ha')).toMatchObject({
      title: 'Tsatsa ta gama gari',
    });
    expect(getDiseaseDetails('Corn_(maize)___Northern_Leaf_Blight', 'yo')).toMatchObject({
      title: 'Gbigbẹ ewé ariwa',
    });
    expect(getDiseaseDetails('Corn_(maize)___healthy', 'ig')).toMatchObject({
      title: 'Akwụkwọ dị mma',
    });
  });

  it('falls back to unavailable guidance when guidance is missing', () => {
    expect(getFallbackGuidance('en')).toMatchObject({
      title: 'Recommendation unavailable',
    });
    expect(translateGuidance(undefined, 'unmapped class', 'en')).toMatchObject({
      title: 'Recommendation unavailable',
    });
  });

  it('prefers localized guidance based on backend guidance or class name', () => {
    expect(
      translateGuidance(
        {
          title: 'Healthy Leaf',
          description: 'backend description',
          treatment: 'backend treatment',
          prevention: 'backend prevention',
        },
        'Corn_(maize)___healthy',
        'ha',
      ),
    ).toMatchObject({
      title: 'Ganye mai lafiya',
    });

    expect(translateGuidance(undefined, 'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'ig'))
      .toMatchObject({
        title: 'Ntụpọ akwụkwọ isi awọ',
      });
  });
});

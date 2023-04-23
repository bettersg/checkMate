import {
  textCosineSimilarity,
  getSimilarityScore,
} from './cosineSimilarityUtils';

describe('textCosineSimilarity', () => {
  it('should should calculate correctly', () => {
    expect(textCosineSimilarity('abc', '')).toBe(0);
    expect(textCosineSimilarity('abc', '123')).toBe(0);
    expect(textCosineSimilarity('abc', 'abc')).toBe(1);
    expect(textCosineSimilarity('abc test', 'abc')).toBe(0.7071067811865475);
    expect(textCosineSimilarity('abc', 'abc test')).toBe(0.7071067811865475);
  });
});

describe('getSimilarityScore', () => {
  it('should calculate correct percentage', () => {
    expect(getSimilarityScore(123)).toBe(12300);
    expect(getSimilarityScore(1.23)).toBe(123);
  });
});

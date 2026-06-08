import { describe, it, expect } from 'vitest';
import { bannerGradient, avatarClasses } from './cardVisuals';

describe('bannerGradient', () => {
  it('returns a CSS linear-gradient string', () => {
    expect(bannerGradient('Shayne Coplan')).toMatch(/^linear-gradient\(120deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
  });
  it('is deterministic for the same name', () => {
    expect(bannerGradient('Jay Deuskar')).toBe(bannerGradient('Jay Deuskar'));
  });
  it('handles an empty name without throwing', () => {
    expect(bannerGradient('')).toMatch(/^linear-gradient/);
  });
});

describe('avatarClasses', () => {
  it('is deterministic for the same name', () => {
    expect(avatarClasses('Shayne Coplan')).toBe(avatarClasses('Shayne Coplan'));
  });
  it('returns a tailwind bg+text class pair', () => {
    expect(avatarClasses('Ada')).toMatch(/^bg-.+ text-.+$/);
  });
});

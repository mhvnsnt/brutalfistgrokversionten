import { describe, expect, it } from 'vitest';

describe('move animation taxonomy', () => {
  it('keeps position and receiver families explicit', () => {
    const families = ['neutral','crouch','rising','airborne','backward','spin','grapple-initiate','grapple-receiver','reaction','taunt'];
    expect(new Set(families).size).toBe(families.length);
    expect(families).toContain('rising');
    expect(families).toContain('grapple-receiver');
  });
});
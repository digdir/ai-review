import { describe, expect, it } from 'vitest';
import { afterKey, toggled } from './board';

describe('board explanation state', () => {
  it('opens one tile at a time', () => {
    expect(toggled(null, 'Phase')).toBe('Phase');
    expect(toggled('Phase', 'Collected')).toBe('Collected');
  });

  it('closes when the same ? is pressed again', () => {
    expect(toggled('Phase', 'Phase')).toBeNull();
  });

  it('closes on Escape and ignores other keys', () => {
    expect(afterKey('Phase', 'Escape')).toBeNull();
    expect(afterKey('Phase', 'Tab')).toBe('Phase');
  });
});

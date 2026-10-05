import { describe, it, expect } from 'vitest';
import { stripShareUrl } from '../src/utils/shareMessage';

const URL_W110 = 'https://karmalandtour.360eye.tech/share/w110';

describe('stripShareUrl', () => {
  it('removes the link from the plot share text so it is only sent once (as url)', () => {
    const text = `📍 *Karma Realtors - Selected Plot Details*\n\n📐 TP: - | FP: - | OP: -\n\n\n🔗 *View on Interactive Map*:\n${URL_W110}`;
    const native = stripShareUrl(text, URL_W110);
    expect(native.includes(URL_W110)).toBe(false);
    expect(native.endsWith('🔗 *View on Interactive Map*:')).toBe(true);
    // what the share target builds: text + url -> exactly one link
    expect(`${native}\n${URL_W110}`.split(URL_W110).length - 1).toBe(1);
  });

  it('works for the general share message that ends with the link', () => {
    const url = 'https://karmalandtour.360eye.tech/';
    const text = `Karma Realtors - Exclusive Land Project\nTake a virtual tour now 👇\n${url}`;
    expect(stripShareUrl(text, url)).toBe('Karma Realtors - Exclusive Land Project\nTake a virtual tour now 👇');
  });

  it('leaves the text untouched when there is no url or the link is not in it', () => {
    expect(stripShareUrl('hello', '')).toBe('hello');
    expect(stripShareUrl('hello', URL_W110)).toBe('hello');
    expect(stripShareUrl(undefined, URL_W110)).toBe('');
  });
});

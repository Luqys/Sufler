import { describe, expect, it } from 'vitest';
import { imageMime, isImagePath } from '../src/shared/media';

describe('imageMime', () => {
  it('rozpoznaje popularne formaty graficzne po rozszerzeniu', () => {
    expect(imageMime('/proj/zrzut.png')).toBe('image/png');
    expect(imageMime('/proj/Zdjęcie.JPG')).toBe('image/jpeg');
    expect(imageMime('/proj/foto.jpeg')).toBe('image/jpeg');
    expect(imageMime('/proj/anim.gif')).toBe('image/gif');
    expect(imageMime('/proj/ikona.svg')).toBe('image/svg+xml');
    expect(imageMime('/proj/nowe.webp')).toBe('image/webp');
    expect(imageMime('/proj/favicon.ico')).toBe('image/x-icon');
  });

  it('odrzuca pliki tekstowe i bez rozszerzenia', () => {
    expect(imageMime('/proj/app.ts')).toBeNull();
    expect(imageMime('/proj/README.md')).toBeNull();
    expect(imageMime('/proj/Makefile')).toBeNull();
    expect(imageMime('/proj/.gitignore')).toBeNull();
  });

  it('patrzy na ostatnie rozszerzenie', () => {
    expect(isImagePath('/proj/archiwum.png.bak')).toBe(false);
    expect(isImagePath('/proj/wykres.d3.svg')).toBe(true);
  });
});

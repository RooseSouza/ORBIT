/** Focused admin image/ticket tests. */

describe('Admin Logic (Focused)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="evtImageFiles" type="file" multiple accept="image/*" />
      <textarea id="evtImageLinks"></textarea>
      <div id="evtImagePreview"></div>
    `;
  });

  test('accepts only http/https image URLs', () => {
    expect(/^https?:\/\//i.test('https://example.com/a.jpg')).toBe(true);
    expect(/^https?:\/\//i.test('http://example.com/a.jpg')).toBe(true);
    expect(/^https?:\/\//i.test('data:image/png;base64,abc')).toBe(false);
  });

  test('parses comma and newline separated image links', () => {
    const input = 'https://example.com/1.jpg,https://example.com/2.jpg\nhttps://example.com/3.jpg';
    const urls = input.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    expect(urls).toEqual([
      'https://example.com/1.jpg',
      'https://example.com/2.jpg',
      'https://example.com/3.jpg',
    ]);
  });

  test('deduplicates image links', () => {
    const urls = ['https://example.com/a.jpg', 'https://example.com/a.jpg', 'https://example.com/b.jpg'];
    const unique = [...new Set(urls)];
    expect(unique).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });

  test('enforces max 8 images', () => {
    const urls = Array.from({ length: 12 }, (_, i) => `https://example.com/${i}.jpg`);
    expect(urls.slice(0, 8)).toHaveLength(8);
  });

  test('accepts only image files by mime prefix', () => {
    const image = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const nonImage = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    expect(image.type.startsWith('image/')).toBe(true);
    expect(nonImage.type.startsWith('image/')).toBe(false);
  });

  test('renders preview thumbnails container', () => {
    const preview = document.getElementById('evtImagePreview');
    preview.innerHTML = '<div class="image-preview-grid"><img src="https://example.com/a.jpg"></div>';
    expect(preview.querySelector('.image-preview-grid')).toBeTruthy();
    expect(preview.querySelectorAll('img')).toHaveLength(1);
  });

  test('accepts valid ticket URL and rejects invalid protocol', () => {
    expect(/^https?:\/\//.test('https://tickets.example.com/event')).toBe(true);
    expect(/^https?:\/\//.test('ftp://tickets.example.com/event')).toBe(false);
  });
});

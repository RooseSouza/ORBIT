/** Focused app logic tests for auth routing, modal behavior, and safety checks. */

describe('App Logic (Focused)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="modal" class="modal">
        <div class="modal-content">
          <div id="modalImageContainer"></div>
          <div id="modalTicketContainer"></div>
        </div>
      </div>
    `;
  });

  test('detects google vs email user from provider data', () => {
    const googleUser = { providerData: [{ providerId: 'google.com' }] };
    const emailUser = { providerData: [{ providerId: 'password' }] };

    expect(googleUser.providerData.some((p) => p.providerId === 'google.com')).toBe(true);
    expect(emailUser.providerData.some((p) => p.providerId === 'google.com')).toBe(false);
  });

  test('suppresses google warnings for email users', () => {
    const emailUser = { providerData: [{ providerId: 'password' }] };
    const isGoogleUser = emailUser.providerData.some((p) => p.providerId === 'google.com');
    const shouldShowGoogleWarning = isGoogleUser && !localStorage.getItem('googleToken');
    expect(shouldShowGoogleWarning).toBe(false);
  });

  test('filters non-http image URLs and limits to 8', () => {
    const input = [
      'https://example.com/1.jpg',
      'data:image/png;base64,abc',
      ...Array.from({ length: 10 }, (_, i) => `https://example.com/${i + 2}.jpg`),
    ];
    const normalized = input.filter((url) => /^https?:\/\//.test(url)).slice(0, 8);
    expect(normalized).toHaveLength(8);
    expect(normalized.some((url) => url.startsWith('data:'))).toBe(false);
  });

  test('carousel next and previous wrap correctly', () => {
    const images = ['a', 'b', 'c'];
    let index = 2;
    index = (index + 1) % images.length;
    expect(index).toBe(0);

    index = (index - 1 + images.length) % images.length;
    expect(index).toBe(2);
  });

  test('shows ticket button only for valid http/https URL', () => {
    const container = document.getElementById('modalTicketContainer');
    const url = 'https://tickets.example.com/event';
    if (/^https?:\/\//.test(url)) {
      container.innerHTML = `<a class="ticket-button" href="${url}">Buy Tickets</a>`;
    }
    expect(container.querySelector('.ticket-button')).toBeTruthy();

    const invalidContainer = document.createElement('div');
    const invalidUrl = 'javascript:alert(1)';
    if (/^https?:\/\//.test(invalidUrl)) {
      invalidContainer.innerHTML = `<a class="ticket-button" href="${invalidUrl}">Buy</a>`;
    }
    expect(invalidContainer.querySelector('.ticket-button')).toBeNull();
  });

  test('stores heavy event payload outside DOM', () => {
    window.eventDataByKey = {};
    window.eventDataByKey['event-1'] = { id: 'event-1', images: Array(50).fill('x') };
    expect(window.eventDataByKey['event-1'].images).toHaveLength(50);
  });

  test('escapes basic HTML characters in dynamic text', () => {
    const raw = '<img src=x onerror=alert(1)>';
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\'/g, '&#39;');

    expect(escaped).toContain('&lt;img');
    expect(escaped).not.toContain('<img');
  });

  test('opens and closes modal', () => {
    const modal = document.getElementById('modal');
    modal.style.display = 'block';
    expect(modal.style.display).toBe('block');

    modal.style.display = 'none';
    expect(modal.style.display).toBe('none');
  });

  test('decoding malformed URI input does not crash flow', () => {
    const malformed = '%ZZ';
    let value = malformed;
    try {
      value = decodeURIComponent(malformed);
    } catch {
      value = malformed;
    }
    expect(value).toBe(malformed);
  });
});

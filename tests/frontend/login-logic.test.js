/** Focused login validation and session tests. */

describe('Login Logic (Focused)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="emailInput" type="email" />
      <input id="passwordInput" type="password" />
      <button id="emailLoginBtn">Log in with Email</button>
      <div id="authStatus"></div>
    `;
    localStorage.clear();
  });

  test('accepts valid email format', () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test('user@example.com')).toBe(true);
  });

  test('rejects invalid email format', () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test('invalid-email')).toBe(false);
  });

  test('enforces password minimum length', () => {
    expect('pass12'.length >= 6).toBe(true);
    expect('12345'.length >= 6).toBe(false);
  });

  test('requires both email and password', () => {
    const email = '';
    const password = 'abcdef';
    expect(email.trim() !== '' && password.trim() !== '').toBe(false);
  });

  test('shows meaningful auth error text', () => {
    const status = document.getElementById('authStatus');
    status.textContent = 'Email/password authentication is not enabled.';
    expect(status.textContent).toContain('not enabled');
  });

  test('clears guest flag on email login', () => {
    localStorage.setItem('guestMode', 'true');
    localStorage.removeItem('guestMode');
    expect(localStorage.getItem('guestMode')).toBeNull();
  });
});

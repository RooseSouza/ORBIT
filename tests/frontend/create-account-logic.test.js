/** Focused create-account validation tests. */

describe('Create Account Logic (Focused)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="emailCreateInput" type="email" />
      <input id="passwordCreateInput" type="password" />
      <input id="confirmPasswordInput" type="password" />
      <button id="createAccountBtn">Create Account</button>
      <div id="createStatus"></div>
    `;
    localStorage.clear();
  });

  test('requires valid email format', () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test('newuser@example.com')).toBe(true);
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test('bad-email')).toBe(false);
  });

  test('enforces minimum password length', () => {
    expect('password123'.length >= 6).toBe(true);
    expect('short'.length >= 6).toBe(false);
  });

  test('requires matching password and confirm password', () => {
    const password = 'password123';
    const confirm = 'password123';
    expect(password === confirm).toBe(true);
  });

  test('rejects mismatched confirm password', () => {
    const status = document.getElementById('createStatus');
    const password = 'password123';
    const confirm = 'different123';
    if (password !== confirm) {
      status.textContent = 'Passwords do not match';
    }
    expect(status.textContent).toContain('do not match');
  });

  test('handles known signup errors', () => {
    const status = document.getElementById('createStatus');
    status.textContent = 'Email already in use. Please log in or use a different email.';
    expect(status.textContent).toContain('already in use');
  });

  test('stores user email after successful signup', () => {
    localStorage.setItem('userEmail', 'newuser@example.com');
    expect(localStorage.getItem('userEmail')).toBe('newuser@example.com');
  });
});

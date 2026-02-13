export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

export function isValidNickname(nickname: string): boolean {
  const nicknameRegex = /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/;
  return nicknameRegex.test(nickname);
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  if (!isValidEmail(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  if (!isValidPassword(password)) {
    return { valid: false, error: 'Password must be at least 6 characters long' };
  }
  return { valid: true };
}

export function validateNickname(nickname: string): { valid: boolean; error?: string } {
  if (!nickname || nickname.trim().length === 0) {
    return { valid: false, error: 'Nickname is required' };
  }
  if (!isValidNickname(nickname)) {
    return { valid: false, error: 'Nickname must start with a letter and contain only alphanumeric characters, underscores, or hyphens (max 32 chars)' };
  }
  return { valid: true };
}

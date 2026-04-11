import { apiRequest } from './http';

export async function requestPasswordReset(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) throw new Error('Email required');
  await apiRequest<unknown>('/auth/forgot-password', {
    method: 'POST',
    json: { email: trimmed },
    auth: false,
  });
}

export async function resetPasswordWithToken(token: string, password: string): Promise<void> {
  const t = token.trim();
  if (!t) throw new Error('Verification code required');
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  await apiRequest<unknown>('/auth/reset-password', {
    method: 'POST',
    json: { token: t, password },
    auth: false,
  });
}

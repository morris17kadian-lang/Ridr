import AsyncStorage from '@react-native-async-storage/async-storage';

import { AUTH_SESSION_KEY } from '../context/AuthContext';
import { getApiBaseUrl } from './config';
import { buildDriverApplicationMultipartBody } from './driverApplicationMultipartBody';

export type DriverApplicationUploadCategory = 'license' | 'qualification' | 'vehicle';

export type DriverApplicationUploadInput = {
  category: DriverApplicationUploadCategory;
  uri: string;
  name: string;
  mimeType?: string;
};

export type SubmitDriverApplicationResponse = {
  applicationId: string;
  status: 'pending_review' | 'approved' | 'rejected';
  user: {
    id: string;
    role: 'user' | 'driver';
  };
  message?: string;
};

export async function submitDriverApplication(
  uploads: DriverApplicationUploadInput[]
): Promise<SubmitDriverApplicationResponse> {
  if (uploads.length === 0) {
    throw new Error('At least one document is required');
  }
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error('Missing EXPO_PUBLIC_BASE_URL');

  const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) throw new Error('Not signed in');
  const session = JSON.parse(raw) as { accessToken?: string };
  if (!session.accessToken) throw new Error('Not signed in');

  const endpoint = `${baseUrl}/drivers/application`;
  const { contentType, body } = await buildDriverApplicationMultipartBody(uploads);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': contentType,
    },
    body: body as unknown as NonNullable<RequestInit['body']>,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`Invalid server response (${res.status})`);
    }
  }

  if (!res.ok) {
    if (res.status === 413) {
      throw new Error('Upload too large. Please use smaller files or fewer documents.');
    }
    let message = `Request failed (${res.status})`;
    if (data && typeof data === 'object') {
      const asObj = data as {
        message?: unknown;
        error?: unknown;
        errors?: unknown;
      };
      if (typeof asObj.message === 'string' && asObj.message.trim()) {
        message = asObj.message;
      } else if (typeof asObj.error === 'string' && asObj.error.trim()) {
        message = asObj.error;
      } else if (Array.isArray(asObj.errors) && asObj.errors.length > 0) {
        const first = asObj.errors[0];
        if (typeof first === 'string' && first.trim()) {
          message = first;
        } else if (first && typeof first === 'object' && 'message' in first) {
          const nested = (first as { message?: unknown }).message;
          if (typeof nested === 'string' && nested.trim()) message = nested;
        }
      }
    }
    throw new Error(message);
  }

  return (data ?? {}) as SubmitDriverApplicationResponse;
}

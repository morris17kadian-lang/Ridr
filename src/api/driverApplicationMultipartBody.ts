import { File as ExpoFsFile } from 'expo-file-system';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';

/** Same shape as `DriverApplicationUploadInput` — kept local to avoid circular imports. */
export type DriverApplicationMultipartPart = {
  category: 'license' | 'qualification' | 'vehicle';
  uri: string;
  name: string;
  mimeType?: string;
};

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const atobFn = globalThis.atob;
  if (!atobFn) throw new Error('atob unavailable');
  const bin = atobFn(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function readUploadBytes(uri: string): Promise<Uint8Array> {
  try {
    const buf = await new ExpoFsFile(uri).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(String(res.status));
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    /* fall through */
  }
  const b64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  return base64ToUint8Array(b64);
}

function ensureUploadFilename(name: string, mimeType?: string): string {
  const base = name.trim() || 'upload';
  if (/\.[a-zA-Z0-9]{2,8}$/.test(base)) return base;
  const m = (mimeType ?? '').toLowerCase();
  if (m.includes('pdf')) return `${base}.pdf`;
  if (m.includes('msword') && !m.includes('openxml')) return `${base}.doc`;
  if (m.includes('wordprocessingml') || m.includes('officedocument.wordprocessingml')) return `${base}.docx`;
  if (m.startsWith('image/jpeg') || m === 'image/jpg') return `${base}.jpg`;
  if (m === 'image/png') return `${base}.png`;
  if (m.startsWith('image/')) return `${base}.jpg`;
  return `${base}.bin`;
}

function safeDispositionFilename(name: string): string {
  return name.replace(/[\r\n"]/g, '_');
}

/**
 * RFC 2388 multipart body with exact field names `documents[i][category]` and `documents[i][file]`.
 * React Native's FormData can omit nested file parts on the wire; building bytes avoids that.
 */
export async function buildDriverApplicationMultipartBody(
  uploads: DriverApplicationMultipartPart[]
): Promise<{ contentType: string; body: Uint8Array }> {
  const boundary = `ridr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const pushText = (s: string) => {
    chunks.push(enc.encode(s));
  };

  for (let i = 0; i < uploads.length; i++) {
    const u = uploads[i];
    const filename = safeDispositionFilename(ensureUploadFilename(u.name, u.mimeType));
    const mime = u.mimeType ?? 'application/octet-stream';

    pushText(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="documents[${i}][category]"\r\n` +
        `\r\n` +
        `${u.category}\r\n`
    );

    const fileBytes = await readUploadBytes(u.uri);
    pushText(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="documents[${i}][file]"; filename="${filename}"\r\n` +
        `Content-Type: ${mime}\r\n` +
        `\r\n`
    );
    chunks.push(fileBytes);
    pushText(`\r\n`);
  }

  pushText(`--${boundary}--\r\n`);

  const body = concatUint8Arrays(chunks);
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body,
  };
}

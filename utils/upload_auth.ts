import { createHash, timingSafeEqual } from 'node:crypto';
import { setResponseHeader, type H3Event } from 'h3';
import { DEFAULT_UPLOAD_LIMITS, type UploadLimits } from '@inteyvat-wiki/wiki-contracts/upload';
import { upload_error } from './upload_error';

export function single_upload_header(event: H3Event, name: string): string | undefined {
    const raw = event.node.req.rawHeaders;
    let count = 0;
    for (let i = 0; i < raw.length; i += 2) if (raw[i]?.toLowerCase() === name) count++;
    if (count > 1) upload_error(400, 'Duplicate upload header');
    const value = event.node.req.headers[name];
    if (Array.isArray(value)) upload_error(400, 'Duplicate upload header');
    return value;
}

export function authenticate_upload(event: H3Event): void {
    setResponseHeader(event, 'Cache-Control', 'no-store');
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
    // Early rejection never drains an unauthenticated/unbounded body into memory.
    setResponseHeader(event, 'Connection', 'close');
    const token = process.env.WIKI_UPLOAD_TOKEN;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) upload_error(503, 'Data upload is disabled');
    const header = single_upload_header(event, 'authorization') || '';
    const provided = /^Bearer ([a-f0-9]{64})$/.exec(header)?.[1] || '';
    const hash = (text: string) => createHash('sha256').update(text).digest();
    if (!timingSafeEqual(hash(provided), hash(token))) upload_error(401, 'Invalid upload authorization');
    if (single_upload_header(event, 'origin') !== undefined) upload_error(403, 'Browser uploads are not supported');
    if (event.node.req.url?.includes('?') || single_upload_header(event, 'cookie') !== undefined) {
        upload_error(400, 'Query strings and cookies are not supported');
    }
}

function setting(name: string, fallback: number, maximum: number): number {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    if (!/^[1-9][0-9]*$/.test(raw)) upload_error(503, 'Invalid upload configuration');
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value > maximum) upload_error(503, 'Invalid upload configuration');
    return value;
}

/** Only lower the tested hard bounds; never allow environment variables to remove caps. */
export function upload_limits(): UploadLimits {
    return {
        maxFiles: setting('WIKI_UPLOAD_MAX_FILES', DEFAULT_UPLOAD_LIMITS.maxFiles, DEFAULT_UPLOAD_LIMITS.maxFiles),
        maxFileBytes: setting('WIKI_UPLOAD_MAX_FILE_BYTES', DEFAULT_UPLOAD_LIMITS.maxFileBytes, DEFAULT_UPLOAD_LIMITS.maxFileBytes),
        maxTotalBytes: setting('WIKI_UPLOAD_MAX_BYTES', DEFAULT_UPLOAD_LIMITS.maxTotalBytes, DEFAULT_UPLOAD_LIMITS.maxTotalBytes),
        maxManifestBytes: setting('WIKI_UPLOAD_MAX_MANIFEST_BYTES', DEFAULT_UPLOAD_LIMITS.maxManifestBytes, DEFAULT_UPLOAD_LIMITS.maxManifestBytes),
    };
}

export function upload_timeouts() {
    const extend = process.env.WIKI_UPLOAD_EXTEND_NODE_TIMEOUT;
    if (extend !== undefined && extend !== '0' && extend !== '1') upload_error(503, 'Invalid upload configuration');
    return { absolute: setting('WIKI_UPLOAD_TIMEOUT_MS', 30 * 60_000, 30 * 60_000),
        idle: setting('WIKI_UPLOAD_IDLE_TIMEOUT_MS', 60_000, 60_000), extendNode: extend === '1' };
}

import { createError } from 'h3';

/** Public upload errors never include a token, request headers, body, or filesystem path. */
export function upload_error(statusCode: number, message: string): never {
    throw createError({ statusCode, message });
}

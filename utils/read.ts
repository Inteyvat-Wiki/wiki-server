import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import type { LocaleCode } from '~~/shared/i18n'

// Maps use a separate protocol; keep its index typed without changing map handlers.
export function read_common(file: 'maps'): Promise<Record<string, string[]>>;
export function read_common(file: string): Promise<unknown>;
export async function read_common(file: string): Promise<unknown> {
    const path = fileURLToPath(new URL(`../../data/common/${file}.json`, import.meta.url))
    try {
        const data = await readFile(path, 'utf-8');
        const value: unknown = JSON.parse(data);
        if (file === 'maps') {
            if (!value || typeof value !== 'object' || Array.isArray(value)
                || !Object.values(value).every(ids => Array.isArray(ids) && ids.every(id => typeof id === 'string'))) {
                throw new Error('Invalid map index');
            }
        }
        return value;
    } catch (error) {
        console.error(`Failed to read file: ${path}`, error);
        throw createError({
            status: 500,
            message: 'Failed to read data file'
        });
    }
}

export async function read_lang(file: string, lang: LocaleCode): Promise<unknown> {
    const path = fileURLToPath(new URL(`../../data/${lang}/${file}.json`, import.meta.url))
    try {
        const data = await readFile(path, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Failed to read file: ${path}`, error);
        throw createError({
            status: 500,
            message: 'Failed to read data file'
        });
    }
}

import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import type { LocaleCode } from '~~/shared/i18n'

export async function read(file: string) {
    const path = fileURLToPath(new URL(`../../data/${file}.json`, import.meta.url))
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

export async function read_lang(file: string, lang: LocaleCode) {
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

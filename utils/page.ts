import { read_common, read_lang } from '#server/utils/read';
import type { LocaleCode } from '~~/shared/i18n';
import type { PageDataTrait } from '~/types/common';

const indexes = new Map<string, Promise<Set<string>>>();

export async function is_data_id(category: string, id: unknown): Promise<boolean> {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) return false;
    let loading = indexes.get(category);
    if (!loading) {
        loading = read_common(`${category}/ids`).then((data: unknown) => {
            if (!Array.isArray(data) || data.some(value => typeof value !== 'string')) {
                throw new Error(`Invalid data ID index: ${category}`);
            }
            return new Set<string>(data);
        }).catch(error => {
            indexes.delete(category);
            throw error;
        });
        indexes.set(category, loading);
    }
    return (await loading).has(id);
}

export async function read_object<T>(category: string, id: unknown, lang: LocaleCode): Promise<T> {
    if (!await is_data_id(category, id)) {
        throw createError({ statusCode: 404, message: `Unknown ${category} data ID` });
    }
    return await read_lang(`${category}/items/${id}`, lang) as T;
}

export async function read_pages<T extends PageDataTrait>(category: string, lang: LocaleCode): Promise<T[]> {
    return await read_lang(`${category}/pages`, lang) as T[];
}

import { read_common, read_lang } from '#server/utils/read';
import type { LocaleCode } from '~~/shared/i18n';
import type { ContentCategory, ExportDocument, ContentPages } from '@inteyvat-wiki/wiki-contracts/registry';
import { assert_content_category, accept_export_document, accept_content_pages, parse_id_index, parse_id_aliases } from './content_boundary';

import { isWikiId } from '@inteyvat-wiki/wiki-contracts/ids';

async function read_id_index(category: ContentCategory): Promise<Set<string>> {
    // Data can be replaced without restarting the server; keep snapshots local to each read.
    return parse_id_index(await read_common(`${category}/ids`));
}

export async function is_data_id(category: ContentCategory, id: unknown): Promise<boolean> {
    assert_content_category(category);
    // Version IDs such as quest-v1.x are valid; empty dot segments and path characters are not.
    if (!isWikiId(id)) return false;
    return (await read_id_index(category)).has(id);
}

export async function read_object<C extends ContentCategory>(category: C, id: unknown, lang: LocaleCode): Promise<ExportDocument<C>> {
    assert_content_category(category);
    if (!isWikiId(id)) {
        throw createError({ statusCode: 404, message: `Unknown ${category} data ID` });
    }
    const ids = await read_id_index(category);
    if (/^[a-zA-Z0-9_-]+$/.test(id)
        && ['serenitea', 'tcg', 'miliastra', 'misc'].includes(category) && !ids.has(id)) {
        const sources = parse_id_aliases(await read_common(`${category}/source_ids`));
        if (sources && typeof sources === 'object' && Object.hasOwn(sources, id)) id = sources[id];
        else {
            const aliases = parse_id_aliases(await read_common(`${category}/id_aliases`));
            if (aliases && typeof aliases === 'object' && Object.hasOwn(aliases, id)) id = aliases[id];
        }
    }
    if (typeof id !== 'string' || !ids.has(id)) {
        throw createError({ statusCode: 404, message: `Unknown ${category} data ID` });
    }
    return accept_export_document(category, await read_lang(`${category}/items/${id}`, lang));
}

export async function read_pages<C extends ContentCategory>(category: C, lang: LocaleCode): Promise<ContentPages<C>> {
    assert_content_category(category);
    return accept_content_pages(category, await read_lang(`${category}/pages`, lang));
}

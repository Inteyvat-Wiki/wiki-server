import type { ContentPages } from '@inteyvat-wiki/wiki-contracts/registry';
import { read_pages } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_text } from '#server/utils/text';

export default defineEventHandler(async (event): Promise<ContentPages<'readable'>> => {
    const lang = get_lang(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(getQuery(event).settings);
    const data = await read_pages('readable', lang);
    return data.map(item => ({ ...item, name: process_text(item.name, settings, t) }));
});

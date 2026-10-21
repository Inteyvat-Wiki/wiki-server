import { read_pages } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_text } from '#server/utils/text';
import type { NpcPage } from '~/types/npc';

export default defineEventHandler(async (event) => {
    const lang = get_lang(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(getQuery(event).settings);
    const pages = await read_pages<NpcPage>('npc', lang);
    return pages.map(page => ({ ...page, name: process_text(page.name, settings, t) }));
});

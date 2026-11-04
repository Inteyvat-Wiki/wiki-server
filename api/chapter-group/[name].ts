import type { DisplayResponse } from '@inteyvat-wiki/wiki-contracts/registry';
import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_text } from '#server/utils/text';

export default defineEventHandler(async (event): Promise<DisplayResponse<'chapter_group'>> => {
    const lang = get_lang(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(getQuery(event).settings);
    const group = await read_object('chapter_group', event.context.params?.name, lang);
    return {
        ...group,
        chapters: group.chapters.map(chapter => ({
            ...chapter,
            name: process_text(chapter.name, settings, t),
        })),
    };
});

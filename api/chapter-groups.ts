import { read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_text } from '#server/utils/text';
import type { ChapterGroups } from '~/types/travel_log';

export default defineEventHandler(async (event) => {
    try {
        const lang = get_lang(event);
        const t = create_i18n(lang).global.t;
        const settings = parse_settings(getQuery(event).settings);
        const groups = await read_lang('chapter_group/list', lang) as ChapterGroups;
        return groups.map(group => ({
            ...group,
            // 章节组名称可能是从章节名提取或自行生成的，不经过原始文本处理。
            chapters: group.chapters.map(chapter => ({
                ...chapter,
                name: process_text(chapter.name, settings, t),
            })),
        }));
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch chapter groups',
        });
    }
});

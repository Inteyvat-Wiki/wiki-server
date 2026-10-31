import { isError } from 'h3';
import { is_archive_category } from '~~/shared/archive';
import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { create_archive_processor } from '#server/utils/archive';
import type { ArchiveItem } from '~/types/archive';

export default defineEventHandler(async event => {
    const category = event.context.params?.category;
    if (!is_archive_category(category)) throw createError({ statusCode: 404, message: 'Unknown archive category' });
    try {
        const lang = get_lang(event);
        const settings = parse_settings(getQuery(event).settings);
        const processor = create_archive_processor(settings, create_i18n(lang).global.t);
        return processor.item(await read_object<ArchiveItem>(category, event.context.params?.name, lang));
    } catch (error) {
        if (isError(error)) throw error;
        console.error(error);
        throw createError({ statusCode: 500, message: 'Failed to fetch archive data' });
    }
});

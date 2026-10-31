import { isError } from 'h3';
import { read_pages } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { create_misc_processor } from '#server/utils/misc';
import type { MiscPageData } from '~/types/misc';

export default defineEventHandler(async event => {
    try {
        const lang = get_lang(event);
        const processor = create_misc_processor(parse_settings(getQuery(event).settings), create_i18n(lang).global.t);
        return (await read_pages<MiscPageData>('misc', lang)).map(processor.page);
    } catch (error) {
        if (isError(error)) throw error;
        console.error(error);
        throw createError({ statusCode: 500, message: 'Failed to fetch misc list' });
    }
});

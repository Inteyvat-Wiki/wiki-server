import { read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import type { LocaleCode } from '~~/shared/i18n';

export default defineEventHandler(async (event) => {
    const lang: LocaleCode = get_lang(event);
    try {
        const data = await read_lang('map/map_conditions', lang);
        return data;
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch map conditions'
        });
    }
});

import { read_pages } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_text } from '#server/utils/text';
import type { LocaleCode } from '~~/shared/i18n';
import type { LivingBeingPage } from '~/types/living_being';

export default defineEventHandler(async (event) => {
    const lang: LocaleCode = get_lang(event);
    try {
        const t = create_i18n(lang).global.t;
        const settings = parse_settings(getQuery(event).settings);
        const data = await read_pages<LivingBeingPage>('living_being', lang);
        return data.map(item => ({
            ...item,
            name: process_text(item.name, settings, t),
        }));
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch living-being list'
        });
    }
});

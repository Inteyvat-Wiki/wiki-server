import { isError } from 'h3';
import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import type { LocaleCode } from '~~/shared/i18n';
import type { Geography } from '~/types/geography';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '~~/server/utils/text';
import { parse_settings } from '#server/utils/settings';

export default defineEventHandler(async (event) => {
    const lang: LocaleCode = get_lang(event);
    const query = getQuery(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(query.settings);

    const name = event.context.params?.name;

    try {
        const rawdata: Geography = await read_object('geography', name, lang);

        let res: Geography = {
            name: process_text(rawdata.name, settings, t),
            description: process_text(rawdata.description, settings, t),
            image: rawdata.image,
            type: rawdata.type,
            area: rawdata.area,
            tabs: rawdata.tabs.map(tab => ({
                name: process_text(tab.name, settings, t),
                description: process_text(tab.description, settings, t)
            }))
        };

        return res;

    } catch (error) {
        if (isError(error)) throw error;
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch geography data'
        });
    }
});

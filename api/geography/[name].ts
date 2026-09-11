import { read, read_lang } from '#server/utils/read';
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

    const geography_list = await read('geographies');
    if (typeof (name) !== 'string' || !(() => {
        for (let type in geography_list) {
            for (let area in geography_list[type]) {
                if (geography_list[type][area].includes(name)) {
                    return true;
                }
            }
        }
        return false;
    })()) {
        throw createError({
            statusCode: 400,
            message: 'Invalid geography name'
        });
    }

    try {
        const rawdata: Geography = await read_lang(`geography/${name}`, lang);

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
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch geography data'
        });
    }
});

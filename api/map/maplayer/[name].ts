import { read, read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import type { LocaleCode } from '~~/shared/i18n';
import type { Maplayer } from '~/types/map';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '~~/server/utils/text';
import { parse_settings } from '#server/utils/settings';

export default defineEventHandler(async (event) => {
    const lang: LocaleCode = get_lang(event);
    const query = getQuery(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(query.settings);
    
    const name = event.context.params?.name;

    const maps = await read('maps');
    const region = (() => {
        for (let region in maps) {
            if (maps[region].includes(name as string)) {
                return region;
            }
        }
        return null;
    })();
    if (typeof (name) !== 'string' || !region) {
        throw createError({
            statusCode: 400,
            message: 'Invalid maplayer name'
        });
    }

    try {

        const rawdata = await read_lang(`map/${name}`, lang) as Maplayer;

        let res: Maplayer = {
            name: rawdata.name,
            region: rawdata.region,
            layers: rawdata.layers.map(layer => ({
                name: process_text(layer.name, settings, t),
                name_old: process_text(layer.name_old, settings, t),
                floor: layer.floor,
                images: layer.images,
            }))
        };

        return res;

    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch map data'
        });
    }
});

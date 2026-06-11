import { read, read_lang } from '#server/utils/read';
import type { Mapback } from '~/types/map';
import type { Settings } from '~/types/settings';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '~~/server/utils/text';

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const lang = (query.lang || 'zh_cn') as string;
    const t = create_i18n(lang).global.t;
    const settings = JSON.parse(query.settings as string || '{}') as Settings;

    const name = event.context.params?.name;

    const map_list = await read('maps');
    if (typeof (name) !== 'string' || !map_list[name]) {
        throw createError({
            statusCode: 400,
            message: 'Invalid mapback name'
        });
    }

    try {

        const rawdata = await read_lang(`map/${name}`, lang) as Mapback;

        let res: Mapback = { images: [], coordinate: rawdata.coordinate };

        for (let item of rawdata.images) {
            res.images.push({
                name: process_text(item.name, settings, t),
                image: item.image,
                coordinate: item.coordinate,
                z_index: item.z_index,
                shown_condition: item.shown_condition,
            });
        }

        return res;

    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch map data'
        });
    }
});
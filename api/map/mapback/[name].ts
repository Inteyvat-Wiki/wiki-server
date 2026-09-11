import { read, read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import type { Mapback } from '~/types/map';

export default defineEventHandler(async (event) => {
    const lang = get_lang(event);

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
                name: item.name,
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

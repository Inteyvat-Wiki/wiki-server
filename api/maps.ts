import { read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_text } from '#server/utils/text';
import type { LocaleCode } from '~~/shared/i18n';
import type { MapList } from '~/types/map';

export default defineEventHandler(async (event) => {
    const lang: LocaleCode = get_lang(event);
    try {
        const t = create_i18n(lang).global.t;
        const settings = parse_settings(getQuery(event).settings);
        const data = await read_lang('map/list', lang) as MapList;
        return Object.fromEntries(Object.entries(data).map(([region, groups]) => [
            region,
            Object.fromEntries(Object.entries(groups).map(([group_name, group]) => [
                group_name,
                {
                    ...group,
                    layers: group.layers.map(layer => ({
                        ...layer,
                        name: process_text(layer.name, settings, t),
                        name_old: process_text(layer.name_old, settings, t),
                    })),
                },
            ])),
        ]));
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch maps'
        });
    }
});

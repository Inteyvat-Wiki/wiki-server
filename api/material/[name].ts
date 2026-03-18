import { read, read_lang } from '#server/utils/read';
import type { Material } from '~/types/material';
import type { Settings } from '~/types/settings';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '~~/server/utils/text';

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const lang = (query.lang || 'zh_cn') as string;
    const t = create_i18n(lang).global.t;
    const settings = JSON.parse(query.settings as string || '{}') as Settings;

    const name = event.context.params?.name;

    const material_list = await read('materials');
    const group = (() => {
        for (let type in material_list) {
            for (let group of material_list[type]) {
                if (typeof group === 'string') {
                    if (group === name) {
                        return group;
                    }
                } else {
                    if (group.includes(name as string)) {
                        return group;
                    }
                }
            }
        }
        return null;
    })();
    if (typeof (name) !== 'string' || !group) {
        throw createError({
            statusCode: 400,
            message: 'Invalid material name'
        });
    }

    try {

        async function get_material(name: string): Promise<Material> {
            const rawdata: Material = await read_lang(`material/${name}`, lang);

            let res: Material = [];
            for (let data of rawdata) {
                res.push({
                    name: data.name,
                    icon: data.icon,
                    star: data.star,
                    type: data.type,
                    info: data.info.map(item => ({
                        title: item.title,
                        description: process_text(item.description, settings, t),
                    })),
                    effect: data.effect ? process_text(data.effect, settings, t) : null,
                    description_full: data.description_full ? process_text(data.description_full, settings, t) : null,
                })
            }

            return res;
        }

        async function get_materials(): Promise<Material> {
            const res: Material = [];
            if (typeof group === 'string') {
                res.push(...(await get_material(group)));
            } else {
                for (const name of group) {
                    res.push(...(await get_material(name)));
                }
            }
            return res;
        }

        const res: Material = await get_materials();

        return res;

    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch material data'
        });
    }
});
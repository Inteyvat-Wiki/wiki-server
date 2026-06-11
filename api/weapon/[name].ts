import { read, read_lang } from '#server/utils/read';
import type { Weapon } from '~/types/weapon';
import type { Weapon as RawWeapon } from '#server/types/raw_weapon';
import type { Settings } from '~/types/settings';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '~~/server/utils/text';
import { round, round_string } from '#server/utils/value';

function get_weapon_stats_list(val: Record<number, string>[]): Record<number, string>[] {
    for (let row of val) {
        for (let key in row) {
            if (row[key]) row[key] = round_string(row[key], 0);
        }
    }
    return val;
}
function get_weapon_substats_list(val: Record<number, string>[]): Record<number, string>[] {
    for (let row of val) {
        for (let key in row) {
            if (row[key]) row[key] = round_string(row[key], 1);
        }
    }
    return val;
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const lang = (query.lang || 'zh_cn') as string;
    const t = create_i18n(lang).global.t;
    const settings = JSON.parse(query.settings as string || '{}') as Settings;

    const name = event.context.params?.name;

    const weapon_list = await read('weapons');
    if (typeof (name) !== 'string' || !weapon_list.includes(name)) {
        throw createError({
            statusCode: 400,
            message: 'Invalid weapon name'
        });
    }

    try {
        const rawdata: RawWeapon = await read_lang(`weapon/${name}`, lang);

        function get_weapon_effect() {
            if (!rawdata.effect) return null;
            
            let description = rawdata.effect.description.replace(/\{(\d+)\}/g, (_, key) => {
                let value_text = '';
                for (let row of rawdata.effect?.values || []) {
                    if (row[key]) value_text = value_text + row[key] + '-';
                }
                return value_text.slice(0, -1);
            });

            return {
                name: rawdata.effect.name,
                description: process_text(description, settings, t),
            }
        }

        let res: Weapon = {
            name: rawdata.name,
            icon: rawdata.icon,
            awaken_icon: rawdata.awaken_icon,
            type: rawdata.type,
            star: rawdata.star,
            stats: {
                base: get_weapon_stats_list(rawdata.stats.base),
                substats_name: rawdata.stats.substats_name,
                substats: get_weapon_substats_list(rawdata.stats.substats || []),
            },
            effect: get_weapon_effect(),
            description: process_text(rawdata.description, settings, t),
            story: process_text(rawdata.story, settings, t),
            refine_material: rawdata.refine_material ? {
                name: rawdata.refine_material.name,
                icon: rawdata.refine_material.icon,
                description: process_text(rawdata.refine_material.description, settings, t),
            } : null
        };

        return res;

    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch weapon data'
        });
    }
});
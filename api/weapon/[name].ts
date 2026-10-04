import { isError } from 'h3';
import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import type { LocaleCode } from '~~/shared/i18n';
import type { Weapon } from '~/types/weapon';
import type { Weapon as RawWeapon } from '#server/types/raw_weapon';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '~~/server/utils/text';
import { parse_settings } from '#server/utils/settings';
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
    const lang: LocaleCode = get_lang(event);
    const query = getQuery(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(query.settings);

    const name = event.context.params?.name;

    try {
        const rawdata: RawWeapon = await read_object('weapon', name, lang);

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
                name: process_text(rawdata.effect.name, settings, t),
                description: process_text(description, settings, t),
            }
        }

        let res: Weapon = {
            name: process_text(rawdata.name, settings, t),
            icon: rawdata.icon,
            awaken_icon: rawdata.awaken_icon,
            type: rawdata.type,
            star: rawdata.star,
            stats: {
                base: get_weapon_stats_list(rawdata.stats.base),
                substats_name: process_text(rawdata.stats.substats_name, settings, t),
                substats: get_weapon_substats_list(rawdata.stats.substats || []),
            },
            effect: get_weapon_effect(),
            description: process_text(rawdata.description, settings, t),
            story: rawdata.story.map(text => process_text(text, settings, t)),
            refine_material: rawdata.refine_material ? {
                name: process_text(rawdata.refine_material.name, settings, t),
                icon: rawdata.refine_material.icon,
                description: process_text(rawdata.refine_material.description, settings, t),
            } : null
        };

        return res;

    } catch (error) {
        if (isError(error)) throw error;
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch weapon data'
        });
    }
});

import { read, read_lang } from '#server/utils/read';
import type { LivingBeing } from '~/types/living_being';
import type { Settings } from '~/types/settings';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '~~/server/utils/text';

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const lang = (query.lang || 'zh_cn') as string;
    const t = create_i18n(lang).global.t;
    const settings = JSON.parse(query.settings as string || '{}') as Settings;

    const name = event.context.params?.name;

    const living_being_list = await read('living_beings');
    const group = (() => {
        for (let type in living_being_list) {
            for (let group of living_being_list[type]) {
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
            message: 'Invalid living_being name'
        });
    }

    try {

        async function get_living_being(name: string): Promise<LivingBeing> {
            const rawdata: LivingBeing = await read_lang(`living_being/${name}`, lang);

            let res: LivingBeing = [];
            for (let data of rawdata) {
                res.push({
                    name: data.name,
                    icon: data.icon,
                    type: data.type,
                    info: data.info.map(item => ({
                        title: item.title,
                        description: process_text(item.description, settings, t),
                    })),
                    description_full: data.description_full ? process_text(data.description_full, settings, t) : null,
                })
            }

            return res;
        }

        async function get_living_beings(): Promise<LivingBeing> {
            const res: LivingBeing = [];
            if (typeof group === 'string') {
                res.push(...(await get_living_being(group)));
            } else {
                for (const name of group) {
                    res.push(...(await get_living_being(name)));
                }
            }
            return res;
        }

        const res: LivingBeing = await get_living_beings();

        return res;

    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch living-being data'
        });
    }
});
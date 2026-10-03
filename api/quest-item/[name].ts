import { read, read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import type { LocaleCode } from '~~/shared/i18n';
import type { QuestItem } from '~/types/quest_item';
import { create_i18n } from '#server/utils/i18n';
import { process_item_common } from '~~/server/utils/item';
import { parse_settings } from '#server/utils/settings';

export default defineEventHandler(async (event) => {
    const lang: LocaleCode = get_lang(event);
    const query = getQuery(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(query.settings);

    const id = event.context.params?.name;

    const quest_item_list = await read('quest_items');
    if (typeof (id) !== 'string' || !(id in quest_item_list)) {
        throw createError({
            statusCode: 400,
            message: 'Invalid quest-item name'
        });
    }

    try {

        async function get_quest_item(name: string): Promise<QuestItem> {
            const rawdata: QuestItem = await read_lang(`quest_item/${name}`, lang);

            let res: QuestItem = [];
            for (let data of rawdata) {
                res.push(process_item_common(data, settings, t));
            }

            return res;
        }

        async function get_quest_items(): Promise<QuestItem> {
            const res: QuestItem = [];
            for (const name of quest_item_list[id!]) {
                res.push(...(await get_quest_item(name)));
            }
            return res;
        }

        const res: QuestItem = await get_quest_items();

        return res;

    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch quest-item data'
        });
    }
});

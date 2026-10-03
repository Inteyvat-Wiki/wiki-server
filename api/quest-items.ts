import { read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_text } from '#server/utils/text';
import type { QuestItems } from '~/types/quest_item';

export default defineEventHandler(async (event) => {
    try {
        const lang = get_lang(event);
        const t = create_i18n(lang).global.t;
        const settings = parse_settings(getQuery(event).settings);
        const data = await read_lang('quest_item/list', lang) as QuestItems;
        return data.map(item => ({
            ...item,
            name: process_text(item.name, settings, t),
        }));
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch quest-item list'
        });
    }
});

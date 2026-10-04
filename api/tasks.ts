import { read_pages } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_text } from '#server/utils/text';
import type { TaskPage } from '~/types/travel_log';

export default defineEventHandler(async (event) => {
    try {
        const lang = get_lang(event);
        const t = create_i18n(lang).global.t;
        const settings = parse_settings(getQuery(event).settings);
        const tasks = await read_pages<TaskPage>('task', lang);
        return tasks.map(task => ({
            ...task,
            name: process_text(task.name, settings, t),
            description: process_text(task.description, settings, t),
            chapter: process_text(task.chapter, settings, t),
        }));
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch task list',
        });
    }
});

import { read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '#server/utils/text';
import { parse_settings } from '#server/utils/settings';
import { is_task_id } from '#server/utils/travel_log';
import type { Task } from '~/types/travel_log';

export default defineEventHandler(async (event) => {
    const id = event.context.params?.name;
    if (typeof id !== 'string' || !await is_task_id(id)) {
        throw createError({
            statusCode: 400,
            message: 'Invalid task name',
        });
    }

    try {
        const lang = get_lang(event);
        const t = create_i18n(lang).global.t;
        const settings = parse_settings(getQuery(event).settings);
        const task = await read_lang(`task/${id}`, lang) as Task;
        return {
            ...task,
            name: process_text(task.name, settings, t),
            description: process_text(task.description, settings, t),
            unlock_description: process_text(task.unlock_description, settings, t),
            chapter: process_text(task.chapter, settings, t),
            steps: Object.fromEntries(Object.entries(task.steps).map(([key, step]) => [key, {
                ...step,
                description: process_text(step.description, settings, t),
            }])),
            talks: Object.fromEntries(Object.entries(task.talks).map(([key, talk]) => [key, {
                ...talk,
                // 条件对象的标题和副标题可能包含任务/步骤的 TextMap 文本；运算符和结构字段保持原样。
                conditions: talk.conditions.map(condition => typeof condition === 'string'
                    ? condition
                    : {
                        ...condition,
                        title: process_text(condition.title, settings, t),
                        subtitle: process_text(condition.subtitle, settings, t),
                    }),
                objects: talk.objects.map(object => process_text(object, settings, t)),
                dialogs: Object.fromEntries(Object.entries(talk.dialogs).map(([dialog_key, dialog]) => [dialog_key, {
                    ...dialog,
                    content: process_text(dialog.content, settings, t),
                    ...(dialog.speaker ? { speaker: process_text(dialog.speaker, settings, t) } : {}),
                    ...(dialog.speaker_subtitle
                        ? { speaker_subtitle: process_text(dialog.speaker_subtitle, settings, t) }
                        : {}),
                }])),
            }])),
        } satisfies Task;
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch task',
        });
    }
});

import { isError } from 'h3';
import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '#server/utils/text';
import { parse_settings } from '#server/utils/settings';
import { create_dialogue_processor } from '#server/utils/dialogue';
import type { Task } from '~/types/travel_log';

export default defineEventHandler(async (event) => {
    const id = event.context.params?.name;
    try {
        const lang = get_lang(event);
        const t = create_i18n(lang).global.t;
        const settings = parse_settings(getQuery(event).settings);
        const task = await read_object<Task>('task', id, lang);
        const process = create_dialogue_processor(settings, t);
        return {
            ...task,
            ...(task.operations ? { operations: process.operations(task.operations) } : {}),
            name: process_text(task.name, settings, t),
            description: process_text(task.description, settings, t),
            unlock_description: process_text(task.unlock_description, settings, t),
            chapter: process_text(task.chapter, settings, t),
            bubbles: Object.fromEntries(Object.entries(task.bubbles || {}).map(([key, bubble]) => [key, process.bubble(bubble)])),
            narrations: Object.fromEntries(Object.entries(task.narrations || {}).map(([key, narration]) => [key, {
                ...narration,
                dialogs: process.dialogs(narration.dialogs),
            }])),
            steps: Object.fromEntries(Object.entries(task.steps).map(([key, step]) => [key, {
                ...step,
                ...(step.operations ? { operations: process.operations(step.operations) } : {}),
                description: process_text(step.description, settings, t),
                finish_conditions: process.conditions(step.finish_conditions),
                fail_conditions: process.conditions(step.fail_conditions || []),
            }])),
            talks: Object.fromEntries(Object.entries(task.talks).map(([key, talk]) => [key, process.talk(talk)])),
        } satisfies Task;
    } catch (error) {
        if (isError(error)) throw error;
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch task',
        });
    }
});

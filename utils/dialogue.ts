import { process_text } from '#server/utils/text';
import type { Settings } from '~/types/settings';
import type { TaskConditionToken, TaskDialog, TaskFinishConditionToken, TaskOperation, TaskTalk } from '~/types/travel_log';

export function create_dialogue_processor(settings: Settings, t: Function) {
    const text = (value: string) => process_text(value, settings, t);
    function conditions<T extends TaskFinishConditionToken>(tokens: T[]): T[] {
        return tokens.map(token => {
            if (typeof token === 'string' || token.type === 'talk') return token;
            const condition = token as Exclude<TaskConditionToken, string>;
            return { ...condition, title: text(condition.title), subtitle: text(condition.subtitle) } as T;
        });
    }
    function operations(values: TaskOperation[] = []): TaskOperation[] {
        return values.map(operation => ({
            ...operation,
            ...(operation.conditions ? { conditions: conditions(operation.conditions) } : {}),
            ...(operation.type === 'item' ? {
                items: operation.items.map(item => ({ ...item, ...(item.name ? { name: text(item.name) } : {}) })),
                ...(operation.choices ? { choices: operation.choices.map(item => ({
                    ...item, ...(item.name ? { name: text(item.name) } : {}),
                })) } : {}),
            } : {}),
        }));
    }
    function next<T extends { conditions?: TaskConditionToken[] }>(values: T[]): T[] {
        return values.map(value => ({
            ...value, ...(value.conditions ? { conditions: conditions(value.conditions) } : {}),
        }));
    }
    function dialogs<T extends TaskDialog>(values: Record<string, T>): Record<string, T> {
        return Object.fromEntries(Object.entries(values).map(([key, dialog]) => [key, {
            ...dialog,
            content: text(dialog.content),
            ...(dialog.speaker ? { speaker: text(dialog.speaker) } : {}),
            ...(dialog.speaker_subtitle ? { speaker_subtitle: text(dialog.speaker_subtitle) } : {}),
            next_dialogs: next(dialog.next_dialogs),
            ...(dialog.operations ? { operations: operations(dialog.operations) } : {}),
        }]));
    }
    function talk<T extends TaskTalk>(value: T): T {
        return {
            ...value,
            objects: value.objects.map(text),
            conditions: conditions(value.conditions),
            dialogs: dialogs(value.dialogs),
            ...(value.initial_dialogs ? { initial_dialogs: next(value.initial_dialogs) } : {}),
            ...(value.operations ? { operations: operations(value.operations) } : {}),
        };
    }
    return { text, conditions, operations, dialogs, talk };
}

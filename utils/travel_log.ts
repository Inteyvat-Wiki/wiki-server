import { is_data_id } from '#server/utils/page';

export function is_task_id(id: unknown): Promise<boolean> {
    return is_data_id('task', id);
}

export function is_chapter_group_id(id: unknown): Promise<boolean> {
    return is_data_id('chapter_group', id);
}

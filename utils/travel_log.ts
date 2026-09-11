import { read } from '#server/utils/read';

type IndexName = 'tasks' | 'chapter_groups';

const index_cache = new Map<IndexName, Set<string>>();

function is_safe_id(value: unknown): value is string {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
}

async function read_id_index(name: IndexName): Promise<Set<string>> {
    const cached = index_cache.get(name);
    if (cached) return cached;

    const data = await read(name);
    if (!Array.isArray(data) || data.some(item => !is_safe_id(item))) {
        throw new Error(`Invalid ${name} index`);
    }

    const ids = new Set(data);
    index_cache.set(name, ids);
    return ids;
}

async function is_indexed_id(name: IndexName, id: unknown): Promise<boolean> {
    return is_safe_id(id) && (await read_id_index(name)).has(id);
}

export function is_task_id(id: unknown): Promise<boolean> {
    return is_indexed_id('tasks', id);
}

export function is_chapter_group_id(id: unknown): Promise<boolean> {
    return is_indexed_id('chapter_groups', id);
}

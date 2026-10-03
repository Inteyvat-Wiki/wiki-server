import { INLINE_LINK_CATEGORIES, is_inline_link_category } from '~~/shared/inline_link';
import { read, read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '#server/utils/text';
import { parse_settings } from '#server/utils/settings';

const indexes = new Map<string, Promise<Set<string>>>();
const summaries = new Map<string, Promise<Map<string, any>>>();

function get_index(name: string): Promise<Set<string>> {
    const cached = indexes.get(name);
    if (cached) return cached;
    const loading = read(name).then(data => {
        const ids = new Set<string>();
        function collect(value: unknown) {
            if (typeof value === 'string') ids.add(value);
            else if (Array.isArray(value)) value.forEach(collect);
            else if (value && typeof value === 'object') {
                if (name === 'quest_items') Object.keys(value).forEach(id => ids.add(id));
                Object.values(value).forEach(collect);
            }
        }
        collect(data);
        return ids;
    }).catch(error => {
        indexes.delete(name);
        throw error;
    });
    indexes.set(name, loading);
    return loading;
}

export default defineEventHandler(async event => {
    const category = event.context.params?.category || '';
    const id = event.context.params?.name || '';
    if (!is_inline_link_category(category) || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        throw createError({ statusCode: 400, message: 'Invalid inline link' });
    }
    const config = INLINE_LINK_CATEGORIES[category];
    if (!(await get_index(config.index)).has(id)) {
        throw createError({ statusCode: 404, message: 'Inline link target not found' });
    }
    let source_id = id;
    if (category === 'quest-item') {
        const groups = await read('quest_items');
        source_id = groups[id]?.at(-1) || id;
    }
    const lang = get_lang(event);
    const summary_key = `${lang}/${config.folder}`;
    let loading = summaries.get(summary_key);
    if (!loading) {
        loading = read_lang(`${config.folder}/list`, lang)
            .then(list => new Map<string, any>(list.map((item: any) => [item.id, item])))
            .catch(error => {
                summaries.delete(summary_key);
                throw error;
            });
        summaries.set(summary_key, loading);
    }
    const summary = (await loading).get(id);
    const data = summary || await read_lang(`${config.folder}/${source_id}`, lang);
    const item = Array.isArray(data) ? data.at(-1) : data;
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(getQuery(event).settings);
    return {
        name: category === 'chapter-group' ? item.name
            : process_text(item.name || (category === 'task' ? t('travel-log.hidden_task') : id), settings, t),
        ...(item.icon || item.chapters?.[0]?.icon ? { icon: item.icon || item.chapters[0].icon } : {}),
    };
});

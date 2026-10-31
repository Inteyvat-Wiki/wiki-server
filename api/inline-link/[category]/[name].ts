import { INLINE_LINK_CATEGORIES, is_inline_link_category, is_inline_link_id } from '~~/shared/inline_link';
import { read_pages } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '#server/utils/text';
import { parse_settings } from '#server/utils/settings';
import type { PageDataTrait } from '~/types/common';
import { create_archive_text_processor } from '#server/utils/archive_text';

const summaries = new Map<string, Promise<Map<string, PageDataTrait>>>();

export default defineEventHandler(async event => {
    const category = event.context.params?.category || '';
    const id = event.context.params?.name || '';
    if (!is_inline_link_category(category) || !is_inline_link_id(id)) {
        throw createError({ statusCode: 400, message: 'Invalid inline link' });
    }
    const { folder } = INLINE_LINK_CATEGORIES[category];
    const lang = get_lang(event);
    const key = `${lang}/${folder}`;
    let loading = summaries.get(key);
    if (!loading) {
        loading = read_pages<PageDataTrait>(folder, lang)
            .then(pages => new Map(pages.map(page => [page.id, page])))
            .catch(error => {
                summaries.delete(key);
                throw error;
            });
        summaries.set(key, loading);
    }
    const page = (await loading).get(id);
    if (!page) throw createError({ statusCode: 404, message: 'Inline link target not found' });
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(getQuery(event).settings);
    const name = page.name || (category === 'task' ? t('travel-log.hidden_task') : id);
    const display_name = ['serenitea', 'tcg', 'miliastra', 'misc'].includes(category)
        ? create_archive_text_processor(settings, t)(name)
        : category === 'chapter-group' ? name : process_text(name, settings, t);
    return {
        name: display_name,
        ...(page.icon ? { icon: page.icon } : {}),
    };
});

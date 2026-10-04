import { read, read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_item_common } from '#server/utils/item';
import { process_text } from '#server/utils/text';
import type { Book } from '~/types/book';

export default defineEventHandler(async (event) => {
    const name = event.context.params?.name;
    const book_list: string[] = await read('books');
    if (!name || !book_list.includes(name)) {
        throw createError({ statusCode: 404, message: 'Book not found' });
    }

    const lang = get_lang(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(getQuery(event).settings);
    const data = await read_lang(`book/${name}`, lang) as Book;
    return data.map(item => ({
        ...process_item_common(item, settings, t),
        name: process_text(item.name, settings, t),
    }));
});

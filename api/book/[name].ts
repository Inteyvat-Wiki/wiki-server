import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_item_common } from '#server/utils/item';
import type { Book } from '~/types/book';

export default defineEventHandler(async event => {
    const lang = get_lang(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(getQuery(event).settings);
    const data = await read_object<Book>('book', event.context.params?.name, lang);
    return process_item_common(data, settings, t);
});

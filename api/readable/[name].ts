import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { process_text } from '#server/utils/text';
import type { Readable } from '~/types/readable';

export default defineEventHandler(async (event) => {
    const name = event.context.params?.name;
    const lang = get_lang(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(getQuery(event).settings);
    const data = await read_object<Readable>('readable', name, lang);
    return {
        name: process_text(data.name, settings, t),
        content: data.content.map(text => process_text(text, settings, t)),
    };
});

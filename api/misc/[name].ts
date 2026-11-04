import type { DisplayResponse } from '@inteyvat-wiki/wiki-contracts/registry';
import { isError } from 'h3';
import { is_misc_id } from '~~/shared/misc';
import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { create_misc_processor } from '#server/utils/misc';

export default defineEventHandler(async (event): Promise<DisplayResponse<'misc'>> => {
    const id = event.context.params?.name;
    if (!is_misc_id(id)) throw createError({ statusCode: 404, message: 'Unknown misc data ID' });
    try {
        const lang = get_lang(event);
        const processor = create_misc_processor(parse_settings(getQuery(event).settings), create_i18n(lang).global.t);
        return processor.item(await read_object('misc', id, lang));
    } catch (error) {
        if (isError(error)) throw error;
        console.error(error);
        throw createError({ statusCode: 500, message: 'Failed to fetch misc data' });
    }
});

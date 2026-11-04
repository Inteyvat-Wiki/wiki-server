import type { DisplayResponse } from '@inteyvat-wiki/wiki-contracts/registry';
import { isWikiId } from '@inteyvat-wiki/wiki-contracts/ids';
import { isError } from 'h3';
import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { create_outfit_processor } from '#server/utils/outfit';

export default defineEventHandler(async (event): Promise<DisplayResponse<'outfit'>> => {
    const id = event.context.params?.id;
    if (!isWikiId(id)) throw createError({ statusCode: 404, message: 'Unknown outfit data ID' });
    try {
        const lang = get_lang(event);
        const processor = create_outfit_processor(parse_settings(getQuery(event).settings), create_i18n(lang).global.t);
        return processor.item(await read_object('outfit', id, lang));
    } catch (error) {
        if (isError(error)) throw error;
        console.error(error);
        throw createError({ statusCode: 500, message: 'Failed to fetch outfit data' });
    }
});

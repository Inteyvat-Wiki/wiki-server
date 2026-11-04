import { read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';
import { select_map_records } from '~~/shared/map_catalogue';

export default defineEventHandler(async event => {
    const query = getQuery(event);
    const value = (key: string) => typeof query[key] === 'string' ? query[key] as string : undefined;
    const offset = Number(value('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw createError({ statusCode: 400, message: 'Invalid offset' });
    return select_map_records(await read_lang('map/catalogue', get_lang(event)), {
        search: value('search')?.slice(0, 200), kind: value('kind'), id: value('id'), offset,
    });
});

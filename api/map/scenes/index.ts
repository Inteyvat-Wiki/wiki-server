import { isMapSceneIndex } from '@inteyvat-wiki/wiki-contracts/map';
import { read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';

export default defineEventHandler(async event => {
    const value = await read_lang('map/scenes', get_lang(event));
    if (!isMapSceneIndex(value)) throw createError({ statusCode: 500, message: 'Invalid map scene index' });
    return value;
});

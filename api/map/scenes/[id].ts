import { isMapScene, isMapSceneIndex } from '@inteyvat-wiki/wiki-contracts/map';
import { read_lang } from '#server/utils/read';
import { get_lang } from '#server/utils/lang';

export default defineEventHandler(async event => {
    const id = getRouterParam(event, 'id');
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) throw createError({ statusCode: 400, message: 'Invalid map scene' });
    const lang = get_lang(event);
    const index = await read_lang('map/scenes', lang);
    if (!isMapSceneIndex(index)) throw createError({ statusCode: 500, message: 'Invalid map scene index' });
    // Old files may remain on disk; only the current export directory is public.
    if (!index.scenes.some(scene => scene.id === id)) throw createError({ statusCode: 404, message: 'Map scene not found' });
    const value = await read_lang(`map/scenes/${id}`, lang);
    if (!isMapScene(value) || value.id !== id) throw createError({ statusCode: 500, message: 'Invalid map scene export' });
    return value;
});

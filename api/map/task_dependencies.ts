import { isMapTaskDependencies } from '@inteyvat-wiki/wiki-contracts/map';
import { read_common } from '#server/utils/read';

export default defineEventHandler(async () => {
    const value = await read_common('map/task_dependencies');
    if (!isMapTaskDependencies(value)) throw createError({ statusCode: 500, message: 'Invalid map task dependencies' });
    return value;
});

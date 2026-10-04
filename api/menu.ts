import { read_common } from '#server/utils/read';

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    try {
        const data = await read_common('menu');
        return data;
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch artifact list'
        });
    }
});

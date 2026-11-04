import { read_common } from '#server/utils/read';
import { parse_menu } from '#server/utils/content_boundary';

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    try {
        const data = await read_common('menu');
        return parse_menu(data);
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch artifact list'
        });
    }
});

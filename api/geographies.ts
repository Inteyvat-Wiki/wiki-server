import { read, read_lang } from '#server/utils/read';

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const lang = (query.lang || 'zh_cn') as string;
    try {
        const data = await read_lang('geography/list', lang);
        return data;
    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch geography list'
        });
    }
});
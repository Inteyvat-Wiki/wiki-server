// Retired manual-map API. Do not read retained historical exports.
export default defineEventHandler(() => {
    throw createError({ statusCode: 410, message: 'This map API was retired. Use /api/map/scenes.' });
});

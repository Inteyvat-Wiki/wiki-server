import { defineNitroPlugin } from 'nitropack/runtime';
import { with_wiki_data_root } from '../utils/data_root';

export default defineNitroPlugin(app => {
    const handler = app.h3App.handler;
    app.h3App.handler = event => {
        // Admin authenticates before touching publication state or the request body.
        if (event.path.split('?')[0]?.replace(/\/$/, '') === '/api/admin/data') return handler(event);
        return with_wiki_data_root(() => handler(event));
    };
});

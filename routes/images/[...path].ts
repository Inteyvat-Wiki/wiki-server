import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createError, defineEventHandler, serveStatic, setResponseHeader } from 'h3';
import { get_wiki_data_root, resolve_data_path } from '../../utils/data_root';

const imageTypes: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// Nitro publicAssets is a build-time copy. Serve published images from the same
// live directory as JSON instead, including files created after the server starts.
export default defineEventHandler(async event => {
    const root = join(get_wiki_data_root(), 'images');
    let selected: string | undefined;
    setResponseHeader(event, 'Cache-Control', 'no-cache');
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
    return serveStatic(event, {
        fallthrough: false,
        indexNames: [],
        async getMeta(id) {
            if (!id.startsWith('/images/')) return;
            let name: string;
            try { name = decodeURIComponent(id.slice('/images/'.length)); }
            catch { return; }
            // Reject encoded separators/traversal and Windows drive/ADS paths too.
            if (!name || /[\\:\x00]/.test(name)
                || name.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) return;
            const type = imageTypes[extname(name).toLowerCase()];
            if (!type) return;
            try {
                const file = resolve_data_path(root, name);
                const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);
                // A file/directory symlink must not expose anything outside images/.
                try { resolve_data_path(realRoot, realFile); } catch { return; }
                const info = await stat(realFile);
                if (!info.isFile()) return;
                selected = realFile;
                return { type, size: info.size, mtime: info.mtime,
                    etag: `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"` };
            } catch (error) {
                if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code || '')) return;
                throw error;
            }
        },
        getContents() {
            if (!selected) throw createError({ statusCode: 404 });
            return createReadStream(selected);
        },
    });
});

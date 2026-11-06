import { defineEventHandler } from 'h3';
import type { UploadStatus } from '@inteyvat-wiki/wiki-contracts/upload';
import { authenticate_upload, upload_limits } from '../../utils/upload_auth';
import { get_wiki_base_root, read_wiki_release, assert_wiki_base } from '../../utils/data_root';
import { upload_error } from '../../utils/upload_error';

export default defineEventHandler((event): UploadStatus => {
    authenticate_upload(event);
    const limits = upload_limits();
    try {
        const base = get_wiki_base_root();
        assert_wiki_base(base);
        return { schema: 1, releaseId: read_wiki_release(base), limits };
    } catch { return upload_error(503, 'Dataset publication storage is unavailable'); }
});

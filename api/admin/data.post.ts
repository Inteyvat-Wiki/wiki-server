import { defineEventHandler, isError } from 'h3';
import { authenticate_upload, upload_limits } from '../../utils/upload_auth';
import { publish_upload } from '../../utils/upload_publish';
import { upload_error } from '../../utils/upload_error';

export default defineEventHandler(async event => {
    authenticate_upload(event);
    const limits = upload_limits();
    try { return await publish_upload(event, limits); }
    catch (error) {
        if (isError(error) && error.statusCode < 500) throw error;
        // Never forward filesystem errors, request data, or native exception messages.
        return upload_error(503, 'Dataset publication failed');
    }
});

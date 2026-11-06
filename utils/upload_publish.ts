import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, open, lstat, readFile, rename, rm, unlink, type FileHandle } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { H3Event } from 'h3';
import { DATA_UPLOAD_MAGIC, DATA_UPLOAD_CONTENT_TYPE, DATA_UPLOAD_TRAILER_BYTES, getUploadManifestError,
    type UploadManifest, type UploadLimits, type UploadResult } from '@inteyvat-wiki/wiki-contracts/upload';
import { assert_real_directory, assert_wiki_base, get_wiki_base_root, read_wiki_release, RELEASE_ID, resolve_data_path, wiki_publish_paths } from './data_root';
import { single_upload_header, upload_timeouts } from './upload_auth';
import { upload_error } from './upload_error';
import { UploadReader } from './upload_stream';
import { parse_upload_json, validate_image_references, validate_png, validate_upload_dataset } from './upload_validation';

type Paths = ReturnType<typeof wiki_publish_paths>;

async function prepare(base: string): Promise<Paths> {
    assert_wiki_base(base);
    const paths = wiki_publish_paths(base);
    for (const directory of [paths.root, paths.staging, paths.releases]) {
        let created = false;
        try { await mkdir(directory, { mode: 0o700 }); created = true; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
        assert_real_directory(directory);
        if (created) { await sync_directory(directory); await sync_directory(dirname(directory)); }
    }
    return paths;
}

async function acquire_lock(paths: Paths): Promise<() => Promise<void>> {
    let handle: FileHandle;
    try { handle = await open(paths.lock, 'wx', 0o600); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') upload_error(409, 'Another upload is in progress');
        throw error;
    }
    const identity = await handle.stat();
    try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, owner: randomBytes(16).toString('hex') }));
        await handle.sync(); await sync_directory(paths.root);
    }
    catch (error) { await handle.close(); await unlink(paths.lock); throw error; }
    return async () => {
        await handle.close();
        // Never remove a replacement lock or reclaim a possibly live/crashed process's lock.
        const current = await lstat(paths.lock);
        if (current.isSymbolicLink() || current.ino !== identity.ino || current.dev !== identity.dev) return;
        await unlink(paths.lock);
    };
}

async function sync_directory(directory: string) {
    // Windows cannot open directory handles with fs.open; rename still provides atomic visibility.
    if (process.platform === 'win32') return;
    const handle = await open(directory, 'r');
    try { await handle.sync(); } finally { await handle.close(); }
}

async function write_all(handle: FileHandle, bytes: Buffer) {
    let offset = 0;
    while (offset < bytes.length) {
        const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset);
        if (!bytesWritten) throw new Error('Unable to write upload');
        offset += bytesWritten;
    }
}

/** Windows sharing/scan handles can briefly deny rename after all our handles close.
 * Retry the SAME atomic operation, never unlink a destination or fall back to copying.
 * Permission failures remain errors after a bounded <2s delay; every attempt rechecks
 * cancellation/deadline (and, for current.json, the compare-and-swap precondition).
 */
async function atomic_rename(from: string, to: string, check: () => void) {
    for (let attempt = 0; ; attempt++) {
        check();
        try { await rename(from, to); return; }
        catch (error) {
            if (attempt >= 7 || !['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
            await delay(Math.min(50 * 2 ** attempt, 400));
        }
    }
}

async function receive_files(reader: UploadReader, staging: string, manifest: UploadManifest) {
    const files = new Set(manifest.files.map(file => file.path));
    const directories = new Set([staging]);
    for (const file of manifest.files) {
        reader.check();
        const destination = resolve_data_path(staging, file.path);
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        assert_real_directory(dirname(destination));
        for (let directory = dirname(destination); directory !== staging; directory = dirname(directory)) directories.add(directory);
        const handle = await open(destination, 'wx', 0o600);
        const hash = createHash('sha256');
        const head = Buffer.alloc(33); let headBytes = 0, remaining = file.size;
        let tail = Buffer.alloc(0);
        try {
            while (remaining > 0) {
                const chunk = await reader.take(remaining);
                hash.update(chunk); await write_all(handle, chunk); remaining -= chunk.length;
                if (headBytes < head.length) headBytes += chunk.copy(head, headBytes, 0, Math.min(chunk.length, head.length - headBytes));
                tail = chunk.length >= 12 ? Buffer.from(chunk.subarray(-12)) : Buffer.concat([tail, chunk]).subarray(-12);
            }
            if (hash.digest('hex') !== file.sha256) upload_error(400, 'File checksum mismatch');
            if (file.path.endsWith('.png')) validate_png(head.subarray(0, headBytes), tail, file.size);
            await handle.sync();
        } finally { await handle.close(); }
        if (file.path.endsWith('.json')) validate_image_references(parse_upload_json(await readFile(destination)), files);
    }
    return directories;
}

/** Reusing a hash never replaces an existing immutable release, even after a crash. */
async function verify_existing(root: string, bytes: Buffer, manifest: UploadManifest, check: () => void) {
    assert_real_directory(root);
    const metadata = join(root, '.manifest.json');
    const info = await lstat(metadata);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== bytes.length || !(await readFile(metadata)).equals(bytes)) {
        upload_error(409, 'Existing release is inconsistent');
    }
    for (const file of manifest.files) {
        check();
        const location = resolve_data_path(root, file.path);
        assert_real_directory(dirname(location));
        const stat = await lstat(location);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== file.size) upload_error(409, 'Existing release is inconsistent');
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(location)) { check(); hash.update(chunk); }
        if (hash.digest('hex') !== file.sha256) upload_error(409, 'Existing release is inconsistent');
    }
}

export async function publish_upload(event: H3Event, limits: UploadLimits): Promise<UploadResult> {
    const base = get_wiki_base_root();
    const paths = await prepare(base);
    const unlock = await acquire_lock(paths);
    let staging: string | undefined, pointerTemp: string | undefined, reader: UploadReader | undefined;
    let stagingIdentity: { ino: number; dev: number } | undefined;
    try {
        const expected = single_upload_header(event, 'x-wiki-base-release');
        if (expected === undefined) upload_error(428, 'Expected base release is required');
        if (expected !== 'none' && !RELEASE_ID.test(expected)) upload_error(400, 'Invalid expected base release');
        const checkBase = () => {
            if ((read_wiki_release(base) || 'none') !== expected) upload_error(409, 'Base release changed');
        };
        checkBase();
        if (single_upload_header(event, 'content-type') !== DATA_UPLOAD_CONTENT_TYPE) upload_error(415, 'Unsupported upload content type');
        const encoding = single_upload_header(event, 'content-encoding');
        if (encoding !== undefined && encoding.toLowerCase() !== 'identity') upload_error(415, 'Encoded uploads are not supported');
        const contentLength = single_upload_header(event, 'content-length');
        if (contentLength !== undefined && (!/^(0|[1-9][0-9]*)$/.test(contentLength) || !Number.isSafeInteger(Number(contentLength)))) {
            upload_error(400, 'Invalid upload content length');
        }
        const magic = Buffer.from(DATA_UPLOAD_MAGIC, 'utf8');
        const maximum = magic.length + 4 + limits.maxManifestBytes + limits.maxTotalBytes + DATA_UPLOAD_TRAILER_BYTES;
        if (contentLength !== undefined && Number(contentLength) > maximum) upload_error(413, 'Upload exceeds limits');
        const timeout = upload_timeouts();
        reader = new UploadReader(event.node.req, maximum, timeout.absolute, timeout.idle, timeout.extendNode);
        if (!(await reader.bytes(magic.length)).equals(magic)) upload_error(400, 'Invalid upload magic');
        const length = (await reader.bytes(4)).readUInt32BE(0);
        if (!length || length > limits.maxManifestBytes) upload_error(413, 'Manifest exceeds limits');
        const manifestBytes = await reader.bytes(length);
        const value = parse_upload_json(manifestBytes);
        if (getUploadManifestError(value, limits)) upload_error(400, 'Invalid upload manifest');
        // Conversion is confined to the shared manifest validation boundary.
        const manifest = value as UploadManifest;
        const total = magic.length + 4 + length + manifest.totalBytes + DATA_UPLOAD_TRAILER_BYTES;
        if (contentLength !== undefined && Number(contentLength) !== total) upload_error(400, 'Upload content length mismatch');
        reader.setExpected(total);
        const digest = createHash('sha256').update(manifestBytes).digest();
        const releaseId = digest.toString('hex');
        staging = await mkdtemp(join(paths.staging, 'upload-'));
        stagingIdentity = await lstat(staging);
        await sync_directory(paths.staging);
        const directories = await receive_files(reader, staging, manifest);
        if (!timingSafeEqual(await reader.bytes(DATA_UPLOAD_TRAILER_BYTES), digest)) upload_error(400, 'Invalid upload completion trailer');
        await reader.eof();
        await validate_upload_dataset(staging, manifest, () => reader!.check());
        reader.check();
        if (event.node.res.destroyed) upload_error(400, 'Upload connection interrupted');
        const metadata = await open(join(staging, '.manifest.json'), 'wx', 0o600);
        try { await metadata.writeFile(manifestBytes); await metadata.sync(); } finally { await metadata.close(); }
        const destination = join(paths.releases, releaseId);
        let exists = false;
        try { await lstat(destination); exists = true; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        if (exists) await verify_existing(destination, manifestBytes, manifest, () => reader!.check());
        else {
            // Files are already fsynced. Persist every nested directory entry bottom-up,
            // including the final .manifest.json, before exposing this release by rename.
            for (const directory of [...directories].sort((a, b) => b.length - a.length)) {
                reader.check(); await sync_directory(directory);
            }
            await atomic_rename(staging, destination, () => reader!.check());
            staging = undefined; // From now on this release is retained, including on pointer failure.
            await sync_directory(paths.staging);
            await sync_directory(paths.releases);
        }
        pointerTemp = join(paths.root, `current-${randomBytes(16).toString('hex')}.tmp`);
        const pointer = await open(pointerTemp, 'wx', 0o600);
        try { await pointer.writeFile(JSON.stringify({ schema: 1, releaseId })); await pointer.sync(); }
        finally { await pointer.close(); }
        await atomic_rename(pointerTemp, paths.current, () => {
            reader!.check();
            if (event.node.res.destroyed) upload_error(400, 'Upload connection interrupted');
            assert_real_directory(paths.root); assert_real_directory(destination);
            checkBase(); // Recheck under the cross-process lock immediately before EVERY attempt.
        });
        pointerTemp = undefined;
        await sync_directory(paths.root);
        return { schema: 1, releaseId, fileCount: manifest.files.length, totalBytes: manifest.totalBytes };
    } finally {
        reader?.dispose();
        try {
            if (pointerTemp) await unlink(pointerTemp);
            if (staging) {
                // Only this request's mkdtemp directory is eligible for recursive cleanup.
                if (dirname(staging) !== paths.staging || !basename(staging).startsWith('upload-')) throw new Error('Unsafe staging cleanup');
                assert_real_directory(staging);
                const current = await lstat(staging);
                if (current.ino === stagingIdentity?.ino && current.dev === stagingIdentity.dev) await rm(staging, { recursive: true });
            }
        } finally { await unlock(); }
    }
}

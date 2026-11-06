import { isAbsolute, relative, resolve, sep, parse, join, dirname } from 'node:path';
import { lstatSync, realpathSync, readFileSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { useRuntimeConfig } from 'nitropack/runtime';

/** Relative paths use the Wiki project directory, never a generated chunk or process cwd. */
export function resolve_wiki_data_root(projectRoot: string, configured = process.env.WIKI_DATA_ROOT): string {
    if (typeof projectRoot !== 'string' || !isAbsolute(projectRoot)) {
        throw new Error('Missing absolute Wiki project root in private runtime configuration');
    }
    return resolve(projectRoot, configured || 'data');
}

export function get_wiki_base_root(): string {
    return resolve_wiki_data_root(useRuntimeConfig().wikiDataProjectRoot);
}

export const RELEASE_ID = /^[a-f0-9]{64}$/;
const requestRoot = new AsyncLocalStorage<string>();

/** Reject junctions/symlinks at every existing component, including configured parents. */
export function assert_real_directory(directory: string): string {
    const absolute = resolve(directory);
    let cursor = parse(absolute).root;
    for (const part of absolute.slice(cursor.length).split(sep).filter(Boolean)) {
        cursor = join(cursor, part);
        const info = lstatSync(cursor);
        if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe publish directory');
    }
    const real = realpathSync(absolute);
    if (relative(real, absolute) !== '') throw new Error('Unsafe publish directory');
    return absolute;
}

export function wiki_publish_paths(base: string) {
    // Keep publisher state out of the exporter/input tree, even when they share a base.
    if (resolve(base) === parse(resolve(base)).root) throw new Error('Data root must not be a filesystem root');
    const root = `${resolve(base)}.publish`;
    return { base, root, staging: join(root, 'staging'), releases: join(root, 'releases'),
        current: join(root, 'current.json'), lock: join(root, 'upload.lock') };
}

/** A first deployment may have no legacy dataset; its existing parent must still be safe. */
export function assert_wiki_base(base: string): void {
    try { lstatSync(base); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        assert_real_directory(dirname(base));
        return;
    }
    assert_real_directory(base);
}

/** Missing pointer means legacy; malformed/unsafe pointers fail closed, not a silent rollback. */
export function read_wiki_release(base: string): string | null {
    const paths = wiki_publish_paths(base);
    try { lstatSync(paths.root); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    assert_real_directory(paths.root);
    let info;
    try { info = lstatSync(paths.current); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.size > 256) throw new Error('Invalid release pointer');
    const value: unknown = JSON.parse(readFileSync(paths.current, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).sort().join(',') !== 'releaseId,schema'
        || (value as { schema?: unknown }).schema !== 1
        || typeof (value as { releaseId?: unknown }).releaseId !== 'string'
        || !RELEASE_ID.test((value as { releaseId: string }).releaseId)) throw new Error('Invalid release pointer');
    const id = (value as { releaseId: string }).releaseId;
    assert_real_directory(join(paths.releases, id));
    return id;
}

export function get_wiki_data_root(): string {
    const pinned = requestRoot.getStore();
    if (pinned) return pinned;
    const base = get_wiki_base_root();
    const release = read_wiki_release(base);
    return release ? join(wiki_publish_paths(base).releases, release) : base;
}

/** Wrap the complete response, including asynchronous nested readers, in one snapshot. */
export function with_wiki_data_root<T>(callback: () => T): T {
    return requestRoot.run(get_wiki_data_root(), callback);
}

/** Both JSON and image readers must stay inside their selected data directory. */
export function resolve_data_path(root: string, ...parts: string[]): string {
    const file = resolve(root, ...parts);
    const child = relative(root, file);
    if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
        throw new Error('Data path is outside the configured directory');
    }
    return file;
}

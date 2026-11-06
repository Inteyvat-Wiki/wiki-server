import { readFile } from 'node:fs/promises';
import { TextDecoder } from 'node:util';
import { CONTENT_CATEGORIES } from '@inteyvat-wiki/wiki-contracts/registry';
import { isWikiId } from '@inteyvat-wiki/wiki-contracts/ids';
import { isMapCatalogue, isMapScene, isMapSceneIndex, isMapTaskDependencies } from '@inteyvat-wiki/wiki-contracts/map';
import { isUploadPath, type UploadManifest } from '@inteyvat-wiki/wiki-contracts/upload';
import { accept_content_pages, accept_export_document, parse_id_aliases, parse_id_index, parse_menu } from './content_boundary';
import { resolve_data_path } from './data_root';
import { upload_error } from './upload_error';

const locales = ['en', 'zh_hans'] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const invalid = () => upload_error(400, 'Invalid dataset structure');

export function parse_upload_json(bytes: Uint8Array): unknown {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { return upload_error(400, 'Invalid UTF-8 JSON'); }
}

/** Traverse iteratively: deeply nested JSON must not overflow the validation stack. */
export function validate_image_references(value: unknown, files: Set<string>): void {
    const pending: unknown[] = [value];
    while (pending.length) {
        const entry = pending.pop();
        if (typeof entry === 'string') {
            // Includes images in formatted text, not only fields named icon/image.
            for (const match of entry.matchAll(/\/images\/[^\s<>"'\[\](){}]+/g)) {
                const image = match[0].slice(1);
                if (!isUploadPath(image) || !files.has(image)) upload_error(400, 'Missing or invalid dataset image');
            }
        } else if (Array.isArray(entry)) {
            for (const child of entry) pending.push(child);
        } else if (record(entry)) {
            for (const child of Object.values(entry)) pending.push(child);
        }
    }
}

/** Lightweight PNG validation only: IHDR fields/CRC and IEND; no image decompressor. */
export function validate_png(head: Buffer, tail: Buffer, size: number): void {
    if (size < 45 || head.length < 33 || head.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
        || head.readUInt32BE(8) !== 13 || head.toString('ascii', 12, 16) !== 'IHDR') {
        upload_error(400, 'Invalid PNG header');
    }
    const width = head.readUInt32BE(16), height = head.readUInt32BE(20);
    const depths: Record<number, readonly number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
    if (!width || !height || width > 0x7fffffff || height > 0x7fffffff || !depths[head[25]!]?.includes(head[24]!)
        || head[26] !== 0 || head[27] !== 0 || head[28]! > 1) upload_error(400, 'Invalid PNG header');
    let crc = 0xffffffff;
    for (const byte of head.subarray(12, 29)) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if (((crc ^ 0xffffffff) >>> 0) !== head.readUInt32BE(29)
        || tail.toString('hex') !== '0000000049454e44ae426082') upload_error(400, 'Invalid PNG header or ending');
}

/** All JSON was parsed during streaming; this pass retains only indices, never the whole dataset. */
export async function validate_upload_dataset(root: string, manifest: UploadManifest, check: () => void): Promise<void> {
    const files = new Set(manifest.files.map(file => file.path));
    const json = async (file: string) => {
        check();
        if (!files.has(file)) invalid();
        return parse_upload_json(await readFile(resolve_data_path(root, file)));
    };
    try {
        parse_menu(await json('common/menu.json'));
        const maps = await json('common/maps.json');
        if (!record(maps) || !Object.values(maps).every(ids => Array.isArray(ids) && ids.every(isWikiId))) invalid();
        for (const category of CONTENT_CATEGORIES) {
            const rawIds = await json(`common/${category}/ids.json`);
            const ids = parse_id_index(rawIds);
            if (!Array.isArray(rawIds) || ids.size !== rawIds.length) invalid();
            for (const alias of ['source_ids', 'id_aliases']) {
                const file = `common/${category}/${alias}.json`;
                if (files.has(file) && !Object.values(parse_id_aliases(await json(file))).every(id => ids.has(id))) invalid();
            }
            let firstPages: Map<string, string> | undefined;
            for (const lang of locales) {
                const pages = accept_content_pages(category, await json(`${lang}/${category}/pages.json`));
                const pageIds = new Set(pages.map(page => page.id));
                const memberships = new Map(pages.map(page => [page.id, JSON.stringify({
                    items: [...page.items].sort(), related: [...page.related_items].sort(),
                    group: page.group ? [page.group.id, page.group.mode] : null,
                })]));
                if (pageIds.size !== pages.length || (firstPages && (pageIds.size !== firstPages.size
                    || [...memberships].some(([id, structure]) => firstPages!.get(id) !== structure)))) invalid();
                firstPages = memberships;
                for (const page of pages) {
                    if (![...page.items, ...page.related_items].every(id => ids.has(id))) invalid();
                }
                for (const id of ids) {
                    const document = await json(`${lang}/${category}/items/${id}.json`);
                    accept_export_document(category, document);
                    // Existing shared guards are deliberately shallow except outfit/maps.
                    if (!record(document) || !(typeof document.name === 'string' || (category === 'task' && document.name === null))) invalid();
                }
                const prefix = `${lang}/${category}/items/`;
                for (const file of files) {
                    if (file.startsWith(prefix) && !ids.has(file.slice(prefix.length, -5))) invalid();
                }
            }
        }
        let firstScenes: Set<string> | undefined;
        let firstCatalogue: Set<string> | undefined;
        for (const lang of locales) {
            const catalogue = await json(`${lang}/map/catalogue.json`);
            const index = await json(`${lang}/map/scenes.json`);
            if (!isMapCatalogue(catalogue) || !isMapSceneIndex(index)) return invalid();
            const catalogueIds = new Set(catalogue.items.map(item => item.id));
            const sceneIds = new Set(index.scenes.map(scene => scene.id));
            if (catalogueIds.size !== catalogue.items.length || sceneIds.size !== index.scenes.length
                || (firstCatalogue && (firstCatalogue.size !== catalogueIds.size || [...catalogueIds].some(id => !firstCatalogue!.has(id))))
                || (firstScenes && (firstScenes.size !== sceneIds.size || [...sceneIds].some(id => !firstScenes!.has(id))))) invalid();
            firstCatalogue = catalogueIds; firstScenes = sceneIds;
            for (const scene of index.scenes) {
                const value = await json(`${lang}/map/scenes/${scene.id}.json`);
                if (!isMapScene(value) || value.id !== scene.id) invalid();
            }
        }
        if (!isMapTaskDependencies(await json('common/map/task_dependencies.json'))) invalid();
    } catch (error) {
        if ((error as { statusCode?: number }).statusCode) throw error;
        invalid();
    }
}

import type { ContentCategory, ContentContractMap, ExportDocument, ContentPages } from '@inteyvat-wiki/wiki-contracts/registry';
import { isContentCategory } from '@inteyvat-wiki/wiki-contracts/registry';
import { isPageDataTrait } from '@inteyvat-wiki/wiki-contracts/common';
import { is_archive_category, is_misc_type, TUTORIAL_CATEGORIES } from '@inteyvat-wiki/wiki-contracts/category';
import { isLoadingSituation, isMessageKind } from '@inteyvat-wiki/wiki-contracts/misc';
import { ARCHIVE_TYPES, CARD_TYPES } from '@inteyvat-wiki/wiki-contracts/archive';
import { isWikiId } from '@inteyvat-wiki/wiki-contracts/ids';
import type { Menu } from '@inteyvat-wiki/wiki-contracts/menu';
import { isOutfitItem, isOutfitPage } from '@inteyvat-wiki/wiki-contracts/outfit';

function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function assert_content_category(value: unknown): asserts value is ContentCategory {
    if (!isContentCategory(value)) throw new Error('Invalid content category');
}

export function parse_id_index(value: unknown): Set<string> {
    if (!Array.isArray(value) || !value.every(isWikiId)) throw new Error('Invalid data ID index');
    return new Set(value);
}

export function parse_id_aliases(value: unknown): Record<string, string> {
    if (!record(value)) throw new Error('Invalid data ID aliases');
    const result: Record<string, string> = Object.create(null);
    for (const [key, id] of Object.entries(value)) {
        if (!isWikiId(key) || !isWikiId(id)) throw new Error('Invalid data ID alias');
        result[key] = id;
    }
    return result;
}

function check_directory_metadata(category: ContentCategory, value: Record<string, unknown>) {
    if (is_archive_category(category)) {
        const types: readonly string[] = ARCHIVE_TYPES[category];
        if (typeof value.type !== 'string' || !types.includes(value.type)) throw new Error(`Invalid ${category} type`);
        const card = value.card_type;
        if (card !== undefined && (!record(card)
            || !CARD_TYPES.some(type => type === card.id) || typeof card.name !== 'string')) {
            throw new Error('Invalid archive card type');
        }
    }
    if (category === 'misc') {
        if (!is_misc_type(value.type)) throw new Error('Invalid misc type');
        if (value.tutorial_category !== undefined && !TUTORIAL_CATEGORIES.some(type => type === value.tutorial_category)) {
            throw new Error('Invalid tutorial category');
        }
    }
}

/** INTERNAL TRUST BOUNDARY, not a deep validator.
 * Published exporter output is trusted only after the checks below. Nested documents
 * (skills, dialogues, complete message graphs, etc.) and category-specific page
 * fields are NOT exhaustively validated, except outfit's complete published-shape guards.
 * Keep the unchecked conversion here, never
 * reintroduce caller-selected result types into read_object/read_pages.
 */
function trust_export<C extends ContentCategory, K extends 'document' | 'page'>(
    _category: C, _kind: K, value: unknown,
): ContentContractMap[C][K] {
    return value as ContentContractMap[C][K];
}

export function accept_export_document<C extends ContentCategory>(category: C, value: unknown): ExportDocument<C> {
    assert_content_category(category);
    if (!record(value)) throw new Error(`Invalid ${category} document container`);
    if (category === 'outfit' && !isOutfitItem(value)) throw new Error('Invalid outfit document');
    check_directory_metadata(category, value);
    if (category === 'misc') {
        if (value.loading_situations !== undefined && (!Array.isArray(value.loading_situations)
            || !value.loading_situations.every(isLoadingSituation))) throw new Error('Invalid loading situations');
        // Validate message discriminants/container, not the full graph or each nested field.
        if (value.message_thread !== undefined && (!record(value.message_thread)
            || !Array.isArray(value.message_thread.nodes)
            || !value.message_thread.nodes.every(node => record(node) && isMessageKind(node.kind)))) {
            throw new Error('Invalid message thread kinds');
        }
    }
    return trust_export(category, 'document', value);
}

export function accept_content_pages<C extends ContentCategory>(category: C, value: unknown): ContentPages<C> {
    assert_content_category(category);
    if (!Array.isArray(value)) throw new Error(`Invalid ${category} pages container`);
    return value.map(page => {
        if (!isPageDataTrait(page) || !record(page)) throw new Error(`Invalid ${category} base page`);
        if (category === 'outfit' && !isOutfitPage(page)) throw new Error('Invalid outfit page');
        check_directory_metadata(category, page);
        return trust_export(category, 'page', page);
    });
}

export function parse_menu(value: unknown): Menu {
    if (!record(value)) throw new Error('Invalid menu');
    const result: Menu = {};
    for (const [key, entry] of Object.entries(value)) {
        if (!record(entry) || typeof entry.icon !== 'string') throw new Error('Invalid menu entry');
        Object.defineProperty(result, key, { value: { ...entry, icon: entry.icon }, enumerable: true, configurable: true, writable: true });
    }
    return result;
}

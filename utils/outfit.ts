import type { OutfitCharacter, OutfitItem, OutfitPage } from '@inteyvat-wiki/wiki-contracts/outfit';
import type { Settings } from '~/types/settings';
import { create_archive_text_processor } from '#server/utils/archive_text';

export function create_outfit_processor(settings: Settings, t: Function) {
    // Reuse the safe process_text wrapper for both lists and details. No source-field interpretation here.
    const text = create_archive_text_processor(settings, t);
    const character = (value: OutfitCharacter | null): OutfitCharacter | null => value && { ...value, name: text(value.name) };
    function page(value: OutfitPage): OutfitPage {
        return { ...value, name: text(value.name), description: text(value.description), character: character(value.character) };
    }
    function item(value: OutfitItem): OutfitItem {
        return { ...value, name: text(value.name), description: text(value.description),
            story: value.story === null ? null : text(value.story), sources: value.sources.map(text), character: character(value.character) };
    }
    return { page, item };
}

import { create_archive_text_processor } from '#server/utils/archive_text';
import type { MiscItem, MiscPageData } from '~/types/misc';
import type { Settings } from '~/types/settings';
import type { LoadingSituation } from '@inteyvat-wiki/wiki-contracts/misc';

export function create_misc_processor(settings: Settings, t: Function) {
    const text = create_archive_text_processor(settings, t);
    function situation(value: LoadingSituation): LoadingSituation {
        switch (value.action) {
            case 'transport':
                return { ...value, ...(value.areas ? { areas: value.areas.map(area => ({ ...area, name: text(area.name) })) } : {}) };
            case 'certain_dungeon':
                return { ...value, ...(value.dungeons ? { dungeons: value.dungeons.map(dungeon => ({ ...dungeon, name: text(dungeon.name) })) } : {}) };
            default:
                return { ...value };
        }
    }
    function page(value: MiscPageData): MiscPageData {
        return { ...value, name: text(value.name), description: text(value.description) };
    }
    function item(value: MiscItem): MiscItem {
        return {
            ...value, name: text(value.name), description: text(value.description),
            sections: value.sections.map(section => ({ ...section,
                ...(section.title !== undefined ? { title: text(section.title) } : {}), text: text(section.text),
            })),
            relations: value.relations.map(relation => ({ ...relation, name: text(relation.name) })),
            ...(value.message_thread ? { message_thread: { initial: [...value.message_thread.initial], nodes: value.message_thread.nodes.map(node => ({ ...node,
                text: text(node.text), ...(node.preview !== undefined ? { preview: text(node.preview) } : {}),
                ...(node.speaker !== undefined ? { speaker: text(node.speaker) } : {}),
                ...(node.location !== undefined ? { location: text(node.location) } : {}),
            })) } } : {}),
            ...(value.loading_situations ? { loading_situations: value.loading_situations.map(situation) } : {}),
        };
    }
    return { page, item };
}

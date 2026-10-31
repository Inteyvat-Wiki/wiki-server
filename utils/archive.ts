import { create_archive_text_processor } from '#server/utils/archive_text';
import { create_dialogue_processor } from '#server/utils/dialogue';
import type { Settings } from '~/types/settings';
import type { ArchiveItem, ArchivePage } from '~/types/archive';
import type { ArchiveClassification } from '~~/shared/archive';

export function create_archive_processor(settings: Settings, t: Function) {
    const text = create_archive_text_processor(settings, t);
    const dialogue = create_dialogue_processor(settings, t, text);
    const classifications = (values: ArchiveClassification[]) => values.map(value => ({ ...value,
        group_name: text(value.group_name), name: text(value.name),
    }));
    const card_metadata = (value: ArchivePage | ArchiveItem) => ({
        ...(value.card_type ? { card_type: { ...value.card_type, name: text(value.card_type.name) } } : {}),
        ...(value.tags ? { tags: value.tags.map(tag => ({ ...tag, name: text(tag.name) })) } : {}),
    });
    function page(value: ArchivePage): ArchivePage {
        return { ...value, name: text(value.name), description: text(value.description),
            ...card_metadata(value),
            ...(value.classifications ? { classifications: classifications(value.classifications) } : {}),
        };
    }
    function item(value: ArchiveItem): ArchiveItem {
        return {
            ...value, name: text(value.name), description: text(value.description),
            ...card_metadata(value),
            ...(value.classifications ? { classifications: classifications(value.classifications) } : {}),
            sections: value.sections.map(section => ({ ...section,
                ...(section.title ? { title: text(section.title) } : {}), text: text(section.text),
            })),
            relations: value.relations.map(relation => ({ ...relation, name: text(relation.name) })),
            talks: Object.fromEntries(Object.entries(value.talks).map(([key, talk]) => [key, {
                ...dialogue.talk(talk),
                title: text(talk.title),
            }])),
        };
    }
    return { page, item };
}

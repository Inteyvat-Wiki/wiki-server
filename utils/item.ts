import type { ItemCommon } from '@inteyvat-wiki/wiki-contracts/common';
import type { Settings } from '~/types/settings';

export function process_item_common<ItemTypes extends string | null>(item: ItemCommon<ItemTypes>, settings: Settings, t: (key: string) => string): ItemCommon<ItemTypes> {
    return {
        name: process_text(item.name, settings, t),
        icon: item.icon,
        star: item.star,
        type: item.type,
        info: item.info.map(info => {
            if (info.type === 'text-list') {
                return {
                    ...info,
                    description: info.description.map(description => process_text(description, settings, t)),
                };
            }

            return {
                ...info,
                description: process_text(info.description, settings, t),
            };
        }),
    };
}

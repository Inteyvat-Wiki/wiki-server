import { ItemCommon } from '@/types/common';

export function process_item_common<ItemTypes extends string>(item: ItemCommon<ItemTypes>, settings: any, t: any): ItemCommon<ItemTypes> {
    return {
        name: item.name,
        icon: item.icon,
        star: item.star,
        type: item.type,
        info: item.info.map(info => (
            info.type === 'description' ? {
                title: info.title,
                description: process_text(info.description, settings, t),
                type: info.type,
            } : {
                title: info.title,
                description: process_text(info.description, settings, t),
                type: info.type,
            }
        )),
    };
}
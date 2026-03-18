import type { WeaponType } from "~/types/common";

export type Weapon = {
    name: string,
    icon: string,
    awaken_icon: string,
    type: WeaponType,
    star: 1 | 2 | 3 | 4 | 5,
    stats: {
        base: Record<number, string>[],
        substats_name: string,
        substats: Record<number, string>[],
    },
    effect: {
        name: string,
        description: string,
        values: string[][],
    } | null,
    description: string,
    story: string,
    refine_material: {
        name: string,
        icon: string,
        description: string,
    } | null,
};
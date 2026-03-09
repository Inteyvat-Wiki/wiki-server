import { ElementType, WeaponType } from "~/types/common";

export type Character = {
    name: string,
    icon: string,
    splash: string,
    element: ElementType,
    weapon: WeaponType,
    star: 4 | 5,
    info: {
        title: string,
        description: string,
    }[],
    stats: {
        hp: Record<number, string>[],
        atk: Record<number, string>[],
        def: Record<number, string>[],
        substats: {
            name: string,
            value: string[],
        }[],
    },
    skills: {
        id: number,
        title: string,
        icon: string,
        description: string,
        details: string[] | null,
        params: Record<string, number[]> | null,
    }[],
    talents: {
        id: number,
        title: string,
        icon: string | null,
        description: string,
        unlock_ascension: number,
    }[],
    constellations: {
        id: number,
        title: string,
        icon: string,
        description: string,
    }[],
    link_description: {
        id: number,
        title: string,
        description: string,
    }[],
    stories: {
        title: string,
        content: string,
        tips: string[],
    }[],
    voiceovers: {
        title: string,
        type: string,
        content: string,
        tips: string[],
    }[],
    images: {
        title: string,
        image: string,
        description: string | null,
    }[],
};
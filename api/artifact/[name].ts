import { read, read_lang } from '#server/utils/read';
import type { Artifact, ArtifactItem } from '~/types/artifact';
import type { Settings } from '~/types/settings';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '~~/server/utils/text';
import { round, round_string } from '#server/utils/value';

function get_artifact_stats_list(val: Record<number, string>[]): Record<number, string>[] {
    for (let row of val) {
        for (let key in row) {
            if (row[key]) row[key] = round_string(row[key], 0);
        }
    }
    return val;
}
function get_artifact_substats_list(val: Record<number, string>[]): Record<number, string>[] {
    for (let row of val) {
        for (let key in row) {
            if (row[key]) row[key] = round_string(row[key], 1);
        }
    }
    return val;
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const lang = (query.lang || 'zh_cn') as string;
    const t = create_i18n(lang).global.t;
    const settings = JSON.parse(query.settings as string || '{}') as Settings;

    const name = event.context.params?.name;

    const artifact_list = await read('artifacts');
    if (typeof (name) !== 'string' || !artifact_list.includes(name)) {
        throw createError({
            statusCode: 400,
            message: 'Invalid artifact name'
        });
    }

    try {
        const rawdata: Artifact = await read_lang(`artifact/${name}`, lang);

        function get_artifact_item<T extends ArtifactItem | (ArtifactItem | null)>(item: T): T {
            if (!item) return item;
            return {
                name: process_text(item.name, settings, t),
                icon: item.icon,
                description: process_text(item.description, settings, t),
                story: process_text(item.story, settings, t),
            } as T;
        }

        let res: Artifact = {
            name: rawdata.name,
            icon: rawdata.icon,
            stars: rawdata.stars,
            effect: {
                "1-piece": process_text(rawdata.effect["1-piece"], settings, t),
                "2-piece": process_text(rawdata.effect["2-piece"], settings, t),
                "3-piece": process_text(rawdata.effect["3-piece"], settings, t),
                "4-piece": process_text(rawdata.effect["4-piece"], settings, t),
                "5-piece": process_text(rawdata.effect["5-piece"], settings, t),
            },
            flower: get_artifact_item(rawdata.flower),
            plume: get_artifact_item(rawdata.plume),
            sands: get_artifact_item(rawdata.sands),
            goblet: get_artifact_item(rawdata.goblet),
            circlet: get_artifact_item(rawdata.circlet),
        };

        return res;

    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch artifact data'
        });
    }
});
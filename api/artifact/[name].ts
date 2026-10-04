import { isError } from 'h3';
import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import type { LocaleCode } from '~~/shared/i18n';
import type { Artifact, ArtifactItem } from '~/types/artifact';
import { create_i18n } from '#server/utils/i18n';
import { process_text } from '~~/server/utils/text';
import { parse_settings } from '#server/utils/settings';

export default defineEventHandler(async (event) => {
    const lang: LocaleCode = get_lang(event);
    const query = getQuery(event);
    const t = create_i18n(lang).global.t;
    const settings = parse_settings(query.settings);

    const name = event.context.params?.name;

    try {
        const rawdata: Artifact = await read_object('artifact', name, lang);

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
            name: process_text(rawdata.name, settings, t),
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
        if (isError(error)) throw error;
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch artifact data'
        });
    }
});

import { read_object } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import { create_i18n } from '#server/utils/i18n';
import { parse_settings } from '#server/utils/settings';
import { create_dialogue_processor } from '#server/utils/dialogue';
import type { Npc } from '~/types/npc';

export default defineEventHandler(async (event) => {
    const lang = get_lang(event);
    const settings = parse_settings(getQuery(event).settings);
    const process = create_dialogue_processor(settings, create_i18n(lang).global.t);
    const npc = await read_object<Npc>('npc', event.context.params?.name, lang);
    return {
        ...npc,
        name: process.text(npc.name),
        talks: Object.fromEntries(Object.entries(npc.talks).map(([key, talk]) => [key, {
            ...process.talk(talk), title: process.text(talk.title),
        }])),
    } satisfies Npc;
});

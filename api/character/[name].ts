import { read, read_lang } from '#server/utils/read';
import { convertDarkHexToLightRGBA } from '#server/utils/color';
import type { Character } from '~/types/character';
import type { Settings } from '~/types/settings';
import { RawCharacter } from '#server/types/raw_character';
import { create_i18n } from '#server/utils/i18n'

function round(num: number, digits: number) {
    const factor = 10 ** digits
    return Math.round((num + Number.EPSILON) * factor) / factor
}
function round_number(str: string, digit: number): string {
    return str.replace(/(-?\d+\.\d+)?/g, (match) => {
        const num = parseFloat(match)
        if (isNaN(num)) return match
        return round(num, digit).toString()
    })
}

function get_character_stats_list(val: Record<number, string>[]): Record<number, string>[] {
    for (let row of val) {
        for (let key in row) {
            if (row[key]) row[key] = round_number(row[key], 0);
        }
    }
    return val;
}
function get_character_substats_list(val: string[]): string[] {
    for (let i = 0; i < val.length; i++) {
        if (val[i]) val[i] = round_number(val[i] || '0', 1);
    }
    return val;
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const lang = (query.lang || 'zh_cn') as string;
    const t = create_i18n(lang).global.t;
    const settings = JSON.parse(query.settings as string) as Settings;

    const name = event.context.params?.name;

    const character_list = await read('characters');
    if (typeof (name) !== 'string' || !character_list.includes(name)) {
        throw createError({
            statusCode: 400,
            message: 'Invalid character name'
        });
    }

    try {
        const rawdata: RawCharacter = await read_lang(`character/${name}`, lang);
        let res: Character = {
            name: rawdata.name,
            icon: rawdata.icon,
            splash: rawdata.splash,
            element: rawdata.element,
            weapon: rawdata.weapon,
            star: rawdata.star,
            info: [],
            stats: {
                hp: [],
                atk: [],
                def: [],
                substats: [],
            },
            skills: [],
            talents: [],
            constellations: [],
            link_description: [],
            stories: [],
            voiceovers: [],
            images: [],
        };

        let links: Record<string, number> = {}, count = 0;
        for (let skill of rawdata.skills) {
            if (skill.id) links[`S${skill.id}`] = ++count;
        }
        for (let talent of rawdata.talents) {
            if (talent.id) links[`P${talent.id}`] = ++count;
        }
        for (let constellation of rawdata.constellations) {
            if (constellation.id) links[`T${constellation.id}`] = ++count;
        }
        for (let link_desc of rawdata.link_description) {
            if (link_desc.id) links[`N${link_desc.id}`] = ++count;
        }

        function parse_details(text: string, params: any) {
            let values: string[] = [];
            let [title, value_text] = text.split('|');

            for (let i = 0; i < 15; i++) {
                if (!value_text) continue;
                values.push(value_text.replace(/{(param\d+):([^{}]*)}/g, (match, key, format) => {
                    if (params[key][i] == undefined) {
                        params[key][i] = params[key][i - 1];
                    }
                    let val = params[key][i] as number;

                    if (format.includes('P')) {
                        val = val * 100;
                    }

                    if (format.includes('F')) {
                        let digit = format.match(/F([\d]+)P?/);
                        if (digit) {
                            val = round(val, parseInt(digit[1]));
                        }
                    } else {
                        val = round(val, 0);
                    }

                    return val.toString() + (format.endsWith('P') ? '%' : '');
                }));
            }

            return {
                title: title || '',
                value: values,
            };
        }
        function process_text(text: string): string {
            if (!text) return text;

            text = text.replace(/\n/g, '<br>');
            text = text.replace(
                /<color=(#[A-Fa-f0-9]{6,8})>(.*?)<\/color>/g,
                (_match, color, content) => {
                    return `<span class="colored_content" style="color:${convertDarkHexToLightRGBA(color)}">${content}</span>`;
                }
            );
            text = text.replace(
                /{LINK#([A-Z0-9]+)}([^{}]+){\/LINK}/g,
                (_match, id, content) => {
                    return `<span class="linked_content" data-id="${links[id]}">${content}</span>`;
                }
            );

            text = text.replace(/{NICKNAME}/g, (_match) => { return settings.traveller_name || t('settings.default_traveller_name'); });
            text = text.replace(/{M#([^{}]+)}/g, (_match, content) => { return settings.traveller == 'aether' ? content : ''; });
            text = text.replace(/{F#([^{}]+)}/g, (_match, content) => { return settings.traveller == 'lumine' ? content : ''; });

            text = text.replace(/{REALNAME\[ID\(1\)\]}/g, (_match) => { return settings.wanderer_name || t('settings.default_wanderer_name'); });
            text = text.replace(/{REALNAME\[ID\(2\)\]}/g, (_match) => { return settings.littleone_name || t('settings.default_littleone_name'); });

            text = text.replace(/{TIMEZONE}/g, (_match) => { return ''; });

            text = text.replace(/#/g, (_match) => { return ''; });
            text = text.replace(
                /{[^{}]+}/g,
                (_match) => {
                    console.error(`Unprocessed placeholder: ${_match}`);
                    return '';
                }
            );
            return text;
        }

        for (let info of rawdata.info) {
            info.description = process_text(info.description);
            res.info.push(info);
        }

        res.stats.hp = get_character_stats_list(rawdata.stats.hp);
        res.stats.atk = get_character_stats_list(rawdata.stats.atk);
        res.stats.def = get_character_stats_list(rawdata.stats.def);
        for (let stat of rawdata.stats.substats) {
            const val = get_character_substats_list(stat.value);
            res.stats.substats.push({
                name: stat.name,
                value: val,
            });
        }

        {
            let index = 0;
            for (let skill of rawdata.skills) {
                let details: { title: string, value: string[] }[] | null = [];
                if (skill.details) {
                    for (let i = 0; i < skill.details.length; i++) {
                        details.push(parse_details(skill.details[i] || '|', skill.params));
                    }
                } else {
                    details = null;
                }

                let sub_title = null;
                ++index;
                if (index == 1) {
                    sub_title = t('skill.normal_attack');
                } else if (index == 2) {
                    sub_title = t('skill.elemental_skill');
                } else if (index == rawdata.skills.length) {
                    sub_title = t('skill.elemental_burst');
                } else {
                    sub_title = t('skill.passive_talent');
                }

                res.skills.push({
                    id: links[`S${skill.id}`] || null,
                    title: process_text(skill.title),
                    sub_title: sub_title,
                    icon: skill.icon,
                    description: process_text(skill.description),
                    details: details,
                });
            }
        }

        for (let talent of rawdata.talents) {
            let sub_title = null;
            if (talent.unlock_ascension > 0) {
                sub_title = t('talent.ascension_talent');
            } else if (talent.unlock_ascension == 0) {
                sub_title = t('talent.passive_talent');
            } else if (talent.unlock_ascension == -1) {
                sub_title = t("talent.additional_talent");
            }

            res.talents.push({
                id: links[`P${talent.id}`] || null,
                title: process_text(talent.title),
                sub_title: sub_title,
                icon: talent.icon,
                description: process_text(talent.description),
            });
        }
        {
            let index = 0;
            for (let constellation of rawdata.constellations) {
                res.constellations.push({
                    id: links[`T${constellation.id}`] || null,
                    title: process_text(constellation.title),
                    sub_title: t(`constellation.constellation${++index}`),
                    icon: constellation.icon,
                    description: process_text(constellation.description),
                })
            }
        }
        for (let link_desc of rawdata.link_description) {
            res.link_description.push({
                id: links[`N${link_desc.id}`] || 0,
                title: process_text(link_desc.title),
                description: process_text(link_desc.description),
            })
        }
        for (let story of rawdata.stories) {
            res.stories.push({
                title: process_text(story.title),
                content: process_text(story.content),
                tips: story.tips.map((tip) => process_text(tip)),
            })
        }
        for (let voiceover of rawdata.voiceovers) {
            if (voiceover.type === 'dialog') {
                res.voiceovers.push({
                    title: process_text(voiceover.title),
                    type: voiceover.type,
                    content: process_text(voiceover.content),
                    tips: voiceover.tips.map((tip) => process_text(tip)),
                })
            }
        }
        for (let image of rawdata.images) {
            res.images.push({
                title: process_text(image.title),
                image: image.image,
                description: image.description ? process_text(image.description) : null,
            })
        }

        return res;

    } catch (error) {
        console.error(error);
        throw createError({
            statusCode: 500,
            message: 'Failed to fetch character data'
        });
    }
});
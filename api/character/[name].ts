import { read, read_lang } from '#server/utils/read';
import { convertDarkHexToLightRGBA } from '#server/utils/color';
import { Character } from '~/types/character';
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
function process_description(text: string, links: Record<string, number>): string {
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
    )
    text = text.replace(
        /{[^{}]+}/g,
        (_match) => {
            console.error(`Unprocessed placeholder: ${_match}`);
            return '';
        }
    )
    return text;
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event)

    const lang = (query.lang || 'zh_cn') as string;
    const t = create_i18n(lang).global.t;

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

        for (let info of rawdata.info) {
            info.description = process_description(info.description, {});
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
                    title: skill.title,
                    sub_title: sub_title,
                    icon: skill.icon,
                    description: process_description(skill.description, links),
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
                title: talent.title,
                sub_title: sub_title,
                icon: talent.icon,
                description: process_description(talent.description, links),
            });
        }
        {
            let index = 0;
            for (let constellation of rawdata.constellations) {
                res.constellations.push({
                    id: links[`T${constellation.id}`] || null,
                    title: constellation.title,
                    sub_title: t(`constellation.constellation${++index}`),
                    icon: constellation.icon,
                    description: process_description(constellation.description, links),
                })
            }
        }
        for (let link_desc of rawdata.link_description) {
            res.link_description.push({
                id: links[`N${link_desc.id}`] || 0,
                title: link_desc.title,
                description: process_description(link_desc.description, links),
            })
        }
        for (let story of rawdata.stories) {
            res.stories.push({
                title: story.title,
                content: process_description(story.content, links),
                tips: story.tips.map((tip) => process_description(tip, links)),
            })
        }
        for (let voiceover of rawdata.voiceovers) {
            if (voiceover.type === 'dialog') {
                res.voiceovers.push({
                    title: voiceover.title,
                    type: voiceover.type,
                    content: process_description(voiceover.content, links),
                    tips: voiceover.tips.map((tip) => process_description(tip, links)),
                })
            }
        }
        for (let image of rawdata.images) {
            res.images.push({
                title: image.title,
                image: image.image,
                description: image.description ? process_description(image.description, links) : null,
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
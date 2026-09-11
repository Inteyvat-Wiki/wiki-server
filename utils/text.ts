import type { Settings } from "~/types/settings";
import { convertDarkHexToLightRGBA } from '#server/utils/color';

function strip_dollar_markers(text: string): string {
    let result = '';
    let index = 0;

    while (index < text.length) {
        if (text[index] !== '$') {
            result += text[index++];
            continue;
        }

        const marker = text.slice(index).match(/^\$[A-Za-z][A-Za-z0-9_]*/)?.[0];
        if (!marker) {
            result += text[index++];
            continue;
        }

        index += marker.length;
        if (marker !== '$END') continue;

        // $END carries one or more bracketed substitution arguments.
        while (text[index] === '[') {
            let depth = 0;
            while (index < text.length) {
                if (text[index] === '[') depth++;
                if (text[index] === ']') {
                    depth--;
                    index++;
                    if (depth === 0) break;
                    continue;
                }
                index++;
            }
        }
    }

    return result;
}

export function process_text<ty extends string | null>(_text: ty, settings: Settings, t: Function): ty {
    if (!_text) return _text;
    let text: string = _text as string;

    text = strip_dollar_markers(text);
    text = text.replace(/\n/g, '<br>');
    text = text.replace(
        /{LAYOUT_MOBILE#([^{}]*)}{LAYOUT_PC#([^{}]*)}{LAYOUT_PS#([^{}]*)}/gi,
        (_match, _mobile, pc) => pc,
    );
    text = text.replace(/{LAYOUT_(?:MOBILE|PC|PS)#([^{}]*)}/gi, (_match, content) => content);
    text = text.replace(/{NON_BREAK_SPACE}/g, ' ');
    text = text.replace(/{SPRITE_PRESET.*?}/gi, '');
    text = text.replace(
        /<color=(#[A-Fa-f0-9]{6,8})>(.*?)<\/color>/g,
        (_match, color, content) => {
            return `<span class="colored_content" style="color:${convertDarkHexToLightRGBA(color)}">${content}</span>`;
        }
    );

    text = text.replace(/{NICKNAME}/g, (_match) => { return settings.traveller_name || t('settings.default_traveller_name'); });
    text = text.replace(/{M#([^{}]+)}/g, (_match, content) => { return settings.traveller == 'aether' ? content : ''; });
    text = text.replace(/{F#([^{}]+)}/g, (_match, content) => { return settings.traveller == 'lumine' ? content : ''; });
    text = text.replace(/{MATEAVATAR#SEXPRO\[INFO_MALE_PRONOUN_BOYD\|INFO_FEMALE_PRONOUN_GIRLD\]}/g,
        (_match) => { return settings.traveller == 'lumine' ? t('text.mate_pronoun_girld') : t('text.mate_pronoun_boyd'); }
    );
    text = text.replace(/{PLAYERAVATAR#SEXPRO\[INFO_MALE_PRONOUN_HE\|INFO_FEMALE_PRONOUN_SHE\]}/g,
        (_match) => { return settings.traveller == 'lumine' ? t('text.pronoun_she') : t('text.pronoun_he'); }
    );

    text = text.replace(
        /{REALNAME\[ID\((1|2)\)(?:\|(?:HOSTONLY|SHOWHOST|DELAYHANDLE)\((?:true|false)\))*\]}/g,
        (_match, id) => id === '1'
            ? settings.wanderer_name || t('settings.default_wanderer_name')
            : settings.littleone_name || t('settings.default_littleone_name'),
    );

    text = text.replace(/{TIMEZONE}/g, (_match) => { return ''; });

    text = text.replace(
        /{RUBY#\[[DS]\]([^{}]+)}/g,
        (_match, ruby_text) => {
            const annotation = ruby_text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            return `<span class="ruby_annotation" data-ruby="${annotation}"></span>`;
        }
    );

    text = text.replace(/#/g, (_match) => { return ''; });
    text = text.replace(
        /{[^{}]+}/g,
        (_match) => {
            console.error(`Unprocessed placeholder: ${_match}`);
            return '';
        }
    );

    return text as ty;
}

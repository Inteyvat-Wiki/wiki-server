import { Settings } from "~/types/settings";
import { convertDarkHexToLightRGBA } from '#server/utils/color';

export function process_text<ty extends string | null>(_text: ty, settings: Settings, t: Function): ty {
    if (!_text) return _text;
    let text: string = _text as string;

    text = text.replace(/\n/g, '<br>');
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

    return text as ty;
}
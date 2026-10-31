import { process_text } from '#server/utils/text';
import { convertDarkHexToLightRGBA } from '#server/utils/color';
import type { Settings } from '~/types/settings';

const escape_html = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Shared by archives and misc: only markup generated here may reach InlineText's SSR path.
export function create_archive_text_processor(settings: Settings, t: Function) {
    const safe_settings = Object.fromEntries(Object.entries(settings).map(([key, value]) =>
        [key, typeof value === 'string' ? escape_html(value) : value])) as Settings;
    return (value: string): string => {
        let prefix = '\uE000archive';
        while ([value, ...Object.values(settings)].some(text => text?.includes(prefix))) prefix += '\uE000';
        const protected_values: string[] = [];
        const protect = (value: string) => {
            protected_values.push(value);
            return `${prefix}${protected_values.length - 1}\uE001`;
        };
        const protected_text = value.replace(/\\n/g, '\n').replace(/\r\n?/g, '\n')
            .replace(/<\/?color(?:=([^<>]*))?>/gi, (tag, color: string = '') => {
                if (tag.startsWith('</')) return protect('</span>');
                if (/^#[a-f\d]{6}(?:[a-f\d]{2})?$/i.test(color)) {
                    const rgba = convertDarkHexToLightRGBA(color.length === 7 ? `${color}FF` : color);
                    return protect(`<span class="colored_content" style="color:${rgba}">`);
                }
                return protect(`<span class="archive-unresolved-color" data-source-color="${escape_html(color)}">`);
            })
            .replace(/<br\s*\/?\s*>|<\/?(?:b|i|u|s)>/gi, tag => protect(tag.toLowerCase()))
            .replace(/\{\d+\}/g, protect);
        let result = process_text(escape_html(protected_text), safe_settings, (key: string) => escape_html(String(t(key))));
        protected_values.forEach((text, index) => {
            result = result.replaceAll(`${prefix}${index}\uE001`, () => text);
        });
        return result;
    };
}

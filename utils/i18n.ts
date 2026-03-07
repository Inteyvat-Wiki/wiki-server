import { createI18n } from 'vue-i18n'
import zh_cn from '~~/i18n/locales/zh_cn.json'
import en from '~~/i18n/locales/en.json'

export function create_i18n(lang: string) {
    return createI18n({
        legacy: false,
        locale: lang,
        messages: { en, zh_cn }
    });
}
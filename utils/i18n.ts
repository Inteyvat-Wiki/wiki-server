import { createI18n } from 'vue-i18n'
import zh_hans from '~~/i18n/locales/zh_hans.json'
import en from '~~/i18n/locales/en.json'
import { DEFAULT_LOCALE, type LocaleCode } from '~~/shared/i18n'

export function create_i18n(lang: LocaleCode = DEFAULT_LOCALE) {
    return createI18n({
        legacy: false,
        locale: lang,
        messages: { en, zh_hans }
    });
}

import { getQuery, type H3Event } from 'h3'
import { DEFAULT_LOCALE, isLocaleCode, type LocaleCode } from '~~/shared/i18n'

export function get_lang(event: H3Event): LocaleCode {
    const query = getQuery(event)
    const rawLocale = Array.isArray(query.lang) ? query.lang[0] : query.lang

    return isLocaleCode(rawLocale) ? rawLocale : DEFAULT_LOCALE
}

import type { Settings } from '~/types/settings';

export function parse_settings(value: unknown): Settings {
    if (typeof value !== 'string') return {} as Settings;

    try {
        const data = JSON.parse(value);
        if (!data || typeof data !== 'object' || Array.isArray(data)) return {} as Settings;

        const settings = data as Record<string, unknown>;
        return {
            traveller: settings.traveller === 'aether'
                ? 'aether'
                : settings.traveller === 'lumine' ? 'lumine' : undefined,
            traveller_name: get_string(settings.traveller_name),
            wanderer_name: get_string(settings.wanderer_name),
            littleone_name: get_string(settings.littleone_name),
        };
    } catch {
        return {} as Settings;
    }
}

function get_string(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

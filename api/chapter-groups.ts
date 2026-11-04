import type { ContentPages } from '@inteyvat-wiki/wiki-contracts/registry';
import { read_pages } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';

export default defineEventHandler((event): Promise<ContentPages<'chapter_group'>> =>
    read_pages('chapter_group', get_lang(event)));

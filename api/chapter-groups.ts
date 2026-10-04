import { read_pages } from '#server/utils/page';
import { get_lang } from '#server/utils/lang';
import type { ChapterGroupPage } from '~/types/travel_log';

export default defineEventHandler(event =>
    read_pages<ChapterGroupPage>('chapter_group', get_lang(event)));

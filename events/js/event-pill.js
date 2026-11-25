// Speech Events: the event pill (cleanup 2026-11-25; one copy for My day and the room header, which had two). The
// event's short name as a pill that links to its type page (#/type/<eventId>). The pill look is status-pill.js.
import { escapeHtml as esc } from '../../core/sheets.js';
import { statusPillHtml } from './status-pill.js';
import { routeHash } from './routes.js';

// opts: { title } true adds the full name as a hover title (My day, where the short name stands alone in a row).
export const eventPillHtml = (eventId, name, short, opts) => statusPillHtml('', short, '', {
  tag: 'a', cls: 'md-ev', attrs: `href="${esc(routeHash('type', eventId))}"${opts && opts.title ? ` title="${esc(name)}"` : ''} aria-label="${esc('About ' + name)}"`,
});

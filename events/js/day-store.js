// Speech Events step S3 (docs/events/EXPERIENCE.md §5, §8.3): reads and writes the judge's days and ballot cards. No
// DOM: app.js passes the store, the clock and the saved rounds, so Node tests can drive a whole day with a fake store.
// The rules live in cards.js (pure); this file only joins them to tabulaEvents.days.v1 and tabulaEvents.cards.v1,
// through the read-time migration (migrate.js).
import { DAYS_KEY, CARDS_KEY } from './store.js';
import { migrateDays, migrateCards } from './migrate.js';
import { dayOf } from './rooms.js';
import { newId } from './room.js';
import { ensureDay, dayFor, withStandby, makeCard, cardForRound, linkRoundToCard, upsert, findById } from './cards.js';

// deps: { store (get, set), now(), makeId (newId by default) }.
export function createDayStore({ store, now, makeId }) {
  const mk = makeId || newId;
  const days = () => migrateDays(store.get(DAYS_KEY, []));
  const cards = () => migrateCards(store.get(CARDS_KEY, []));
  const saveDays = (list) => store.set(DAYS_KEY, list);
  const saveCards = (list) => store.set(CARDS_KEY, list);
  const today = () => dayFor(days(), dayOf(now()));

  // Today's day, made and saved when it is missing. null when the save failed.
  function ensureToday() {
    const res = ensureDay(days(), dayOf(now()), now(), mk);
    if (res.made && !saveDays(res.days)) return null;
    return res.day;
  }
  const saveDay = (day) => saveDays(upsert(days(), day));
  const saveCard = (card) => saveCards(upsert(cards(), card));
  const card = (id) => findById(cards(), id);

  return Object.freeze({
    days, cards, today, ensureToday, saveDay, saveCard, card,
    // Standby on or off for today (§5.1). Returns the saved day, or null.
    setStandby(on) {
      const d = ensureToday();
      if (!d) return null;
      const next = withStandby(d, on, now());
      return saveDay(next) ? next : null;
    },
    // A new card on today's day (the confirm sheet, §5.2). The day takes the tournament when it has none yet.
    // fields: { event, tournament, round, flight, level, roomLabel }. Returns the saved card, or null.
    addCard(fields) {
      const d = ensureToday();
      if (!d) return null;
      if (!d.tournament && fields.tournament && !saveDay(Object.assign({}, d, { tournament: String(fields.tournament).trim() }))) return null;
      const c = makeCard(Object.assign({}, fields, { day: d, now: now(), makeId: mk }));
      return saveCard(c) ? c : null;
    },
    // A round was just made in setup. With a card: link it. Without one (#/new): make its card (decision 2a).
    // Returns { round, card }: the round with the card's fields (dayId, cardId, level, roomLabel) and the linked card.
    // Nothing is saved here: the caller saves the round first, then the card (saveCard), so a failed save never leaves
    // a card that points at a round that is not there. card is null when today's day could not be saved.
    // edits: what the judge changed on the setup form for this card (step S4 added a Level field there), given to the
    // card before it is joined, so the card's level (which the round takes) is the one the judge picked last.
    linkNewRound(round, cardId, edits) {
      let c = cardId ? card(cardId) : null;
      if (c && edits && (edits.level === 'elim' || edits.level === 'prelim')) c = Object.assign({}, c, { level: edits.level });
      if (!c) {
        const d = ensureToday();
        if (!d) return { round, card: null };
        c = cardForRound(round, d, now(), mk);
      }
      return linkRoundToCard(round, c);
    },
    // The card for a round that has none (a round from before S3, acted on from My day). Saved; null on failure.
    adopt(round) {
      const d = ensureToday();
      if (!d) return null;
      const c = cardForRound(round, d, now(), mk);
      return saveCard(c) ? c : null;
    },
  });
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).dayStore = Object.freeze({ createDayStore });

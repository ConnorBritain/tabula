// A waiting page uses no saved rounds, keys or clocks. Retry is the only action.
export function writerWaitingHtml(status) {
  const unavailable = status === 'unavailable', paused = status === 'lost';
  const title = unavailable ? 'Events cannot open safely right now' : paused ? 'Open a fresh Events page' : 'Events is open in another tab';
  const text = unavailable ? 'Check this browser’s settings or use another browser, then retry. Your saved data has not changed.'
    : paused ? 'This page paused. Choose Retry to open a fresh copy of your saved data.'
      : 'Keep working in that tab. To use this tab, close the other Events tab, then choose Retry.';
  return `<section class="set-part" id="events-waiting" aria-labelledby="events-waiting-h"><h1 id="events-waiting-h" tabindex="-1">${title}</h1><p>${text}</p><div class="set-row"><button class="b" type="button" id="events-writer-retry">Retry</button></div></section>`;
}
export function createWriterWaitingView({ el, writer, retry }) {
  const click = async (event) => {
    if (event.target.id !== 'events-writer-retry') return;
    event.target.disabled = true;
    await retry();
  };
  function show() {
    el.innerHTML = writerWaitingHtml(writer.state().status);
    el.removeEventListener('click', click); el.addEventListener('click', click);
    el.querySelector('#events-waiting-h')?.focus();
  }
  function hide() { el.removeEventListener('click', click); }
  return { scope: 'waiting', show, hide };
}

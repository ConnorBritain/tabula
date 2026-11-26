// How to add the app to the Home Screen (or install it), for the browser the judge is using. Shared by Tabula Debate
// and Speech Events. Pure apart from isStandalone, which reads the window it is given. Nothing here touches the DOM.
//
// Why it matters: Safari on iPhone and iPad can delete a site's saved data after about 7 days without a visit. A site
// added to the Home Screen keeps its data. Other browsers clear data less often, so their hint is optional.

/** Is the page running as an installed app (from the Home Screen or an app window)? False when the window cannot say. */
export function isStandalone(win = globalThis) {
  try {
    if (!win) return false;
    if (typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches) return true;
    return Boolean(win.navigator && win.navigator.standalone === true);
  } catch { return false; }
}

// Browsers on iPhone and iPad that are not Safari (they name themselves in the user agent), and apps that open pages
// inside themselves. The hint is for Safari only, so these get none.
const IOS_OTHER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|Brave|GSA\/|FBAN|FBAV|FBIOS|Instagram|LinkedInApp|Snapchat|Twitter|Line\/|MicroMessenger|Pinterest|TikTok|musical_ly/;

const IOS_WHY = 'Safari can delete this app\'s data if you do not open it for about 7 days. Adding it to your Home Screen keeps it.';
const OTHER_WHY = 'An installed app opens in its own window and is less likely to have its data cleared.';

/**
 * The hint for this browser, or null when there is none to give.
 * v: { ua (navigator.userAgent), standalone (isStandalone()), platform (navigator.platform), maxTouchPoints }.
 * Returns null | { kind: 'ios-safari' | 'android-chrome' | 'desktop', steps: [string], why: string }.
 * An iPad in desktop mode says "Macintosh"; it is told apart from a Mac by platform 'MacIntel' with touch points.
 */
export function installHint(v) {
  const o = v || {};
  if (o.standalone) return null;
  const ua = typeof o.ua === 'string' ? o.ua : '';
  if (!ua) return null;
  const touch = Number(o.maxTouchPoints) || 0;
  const ipadDesktop = o.platform === 'MacIntel' && touch > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || ipadDesktop;
  if (ios) {
    // Safari says "Version/x ... Safari/y". In-app views usually lack "Safari/"; other browsers add their own name.
    if (IOS_OTHER.test(ua) || !/Version\/[\d.]+.*Safari\//.test(ua)) return null;
    return { kind: 'ios-safari', why: IOS_WHY, steps: [
      'Tap the Share button (the square with an arrow pointing up).',
      'Scroll down and tap "Add to Home Screen".',
      'Tap "Add". Then open the app from your Home Screen.',
    ] };
  }
  if (/Android/.test(ua)) {
    // Chrome itself: not an in-app view ("; wv)"), not Samsung Internet, Edge, Opera or Firefox, which have other menus.
    if (!/Chrome\/\d/.test(ua) || /; wv\)|SamsungBrowser|EdgA|OPR\/|Firefox|YaBrowser|UCBrowser/.test(ua)) return null;
    return { kind: 'android-chrome', why: OTHER_WHY, steps: [
      'Tap the menu button (three dots) at the top right.',
      'Tap "Add to Home screen" or "Install app".',
      'Tap "Install" or "Add".',
    ] };
  }
  if (/Mobile|Tablet/.test(ua)) return null;
  // A computer: Chrome and Edge install from the address bar; Safari on a Mac adds to the Dock.
  if (/Edg\/|Chrome\/\d/.test(ua) && !/OPR\/|Firefox/.test(ua)) {
    return { kind: 'desktop', why: OTHER_WHY, steps: [
      'Click the install icon at the right end of the address bar.',
      'Or open the browser menu and choose "Install" (in Chrome it may be under "Cast, save and share").',
      'Click "Install".',
    ] };
  }
  if (/Macintosh/.test(ua) && /Version\/[\d.]+.*Safari\//.test(ua)) {
    return { kind: 'desktop', why: OTHER_WHY, steps: [
      'Open the File menu at the top of the screen.',
      'Choose "Add to Dock".',
      'Click "Add".',
    ] };
  }
  return null;
}

(globalThis.TabulaCore = globalThis.TabulaCore || {})['install-hint'] = Object.freeze({ isStandalone, installHint });

// The five device types a judge is likely to bring, as browser emulation settings for the device pass.
// Pure data: no browser needed, so the unit tests in events/device-pass.test.mjs can check it.
// Each profile is a close copy, not the real device: Chromium (or WebKit, when it is installed) draws the page with the
// device's screen size, pixel density, touch and user agent. Real phones still need the manual checklist
// (docs/events/DEVICE-CHECK.md).

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// iPadOS Safari asks for the desktop site by default, so it sends a Mac user agent. The pass copies that.
const IPADOS_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const CROS_CHROME = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';

// engine: the browser the real device uses. 'webkit' runs on WebKit when it is installed, else on Chromium (the report
// says which). phone: true for the small screens where the light-theme phone shots matter most.
export const PROFILES = Object.freeze([
  Object.freeze({
    id: 'iphone', name: 'iPhone 15, Safari', engine: 'webkit', phone: true,
    context: { viewport: { width: 393, height: 659 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IOS_SAFARI },
  }),
  Object.freeze({
    id: 'android', name: 'Pixel 7, Chrome', engine: 'chromium', phone: true,
    context: { viewport: { width: 412, height: 839 }, screen: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: ANDROID_CHROME },
  }),
  Object.freeze({
    id: 'chromebook', name: 'School Chromebook, Chrome OS', engine: 'chromium', phone: false,
    context: { viewport: { width: 1366, height: 768 }, screen: { width: 1366, height: 768 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, userAgent: CROS_CHROME },
  }),
  Object.freeze({
    id: 'ipad', name: 'iPad (10th gen), Safari', engine: 'webkit', phone: false,
    context: { viewport: { width: 820, height: 1180 }, screen: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPADOS_SAFARI },
  }),
  Object.freeze({
    id: 'windows', name: 'Windows laptop, Edge', engine: 'chromium', phone: false,
    context: { viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, userAgent: WIN_EDGE },
  }),
]);

export const THEMES = Object.freeze(['light', 'dark']);

/** The profiles named in a comma list ("iphone,ipad"), in PROFILES order. Empty or missing: all. Unknown id: throws. */
export function pickProfiles(list) {
  const want = String(list || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!want.length) return [...PROFILES];
  const bad = want.filter((id) => !PROFILES.some((p) => p.id === id));
  if (bad.length) throw new Error(`Unknown device: ${bad.join(', ')}. Known: ${PROFILES.map((p) => p.id).join(', ')}`);
  return PROFILES.filter((p) => want.includes(p.id));
}

/** The browser to launch for a profile: its own engine when that one is installed, else Chromium. */
export function engineFor(profile, installed) {
  return installed.includes(profile.engine) ? profile.engine : 'chromium';
}

// The screens the pass walks, in order. The summary table sorts by this list. Every screen type a judge meets:
// both Congress and three speech families, plus the rank, rate, review and the app-wide screens.
export const SCREENS = Object.freeze([
  'Header (every screen)',
  'My day', 'Picker', 'Type page', 'Room setup', 'Room: interp (HI)', 'Rank', 'Review and copy', 'Review offline',
  'Room: public address (OO)', 'Room: limited prep (USX)', 'Room: Pro Con Challenge (PCC)', 'Rate',
  'History', 'Settings', 'Palette',
  'Congress setup', 'Congress log', 'Congress PO hour', 'Congress rank', 'Congress review', 'Congress offline', 'Congress chambers',
  'My day (with rounds)',
]);

/**
 * Validation of the `?return=` parameter the dryland-test-logger bridge passes.
 *
 * The value is navigated to when the user taps "Send to seco", so an unchecked
 * value would accept `javascript:` URLs and any foreign domain. Only an http(s)
 * URL on this app's own origin, or on localhost / 127.0.0.1 (development), is
 * safe to navigate to.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export function isSafeReturnUrl(returnUrl, currentOrigin) {
  if (typeof returnUrl !== 'string' || returnUrl === '') return false;
  let url;
  try {
    url = new URL(returnUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  return url.origin === currentOrigin || LOCAL_HOSTNAMES.has(url.hostname);
}

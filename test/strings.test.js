import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { t, getLang, setLang, hasOwnKey, keysFor } from '../src/i18n/strings.js';

const DIR = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));

describe('detectDefaultLang (fresh module load, no saved preference)', () => {
  // Each sub-test here needs its own never-before-imported module instance — currentLang is set
  // once at load time from navigator.language, and every other test in this file also mutates
  // the ONE shared instance via setLang(), so re-importing the same specifier would just hand
  // back that already-mutated instance. A distinct cache-busting query string per sub-test is
  // what forces Node's ESM loader to actually re-evaluate the module.
  //
  // Node itself defines a global `navigator` since v21 — on this machine `navigator.language`
  // reads 'es-ES' (the OS locale), not undefined, so the two cases below are exercised by
  // overriding it, not by assuming it is absent.
  async function withNavigatorLanguage(lang, fn) {
    // `language` is an accessor on Navigator.prototype, not an own property, so there is no own
    // descriptor to save and restore — overriding with an own, configurable data property and
    // then deleting it again is what lets the prototype's own getter show back through. The
    // `await` here is load-bearing: fn() returns the still-pending dynamic import() promise, and
    // module evaluation for it happens later, in a microtask — restoring navigator.language in a
    // bare (non-async) `finally` would run before that evaluation and undo the override too soon.
    Object.defineProperty(navigator, 'language', { value: lang, configurable: true });
    try {
      return await fn();
    } finally {
      delete navigator.language;
    }
  }

  test('an es-* browser locale defaults to es', async () => {
    const fresh = await withNavigatorLanguage('es-MX', () => import('../src/i18n/strings.js?fresh-es'));
    assert.equal(fresh.getLang(), 'es');
  });

  test('a non-es browser locale defaults to en', async () => {
    const fresh = await withNavigatorLanguage('en-US', () => import('../src/i18n/strings.js?fresh-en'));
    assert.equal(fresh.getLang(), 'en');
  });

  test('a saved localStorage preference wins over navigator.language', async () => {
    const fakeStorage = { getItem: (k) => (k === 'angle-lab/lang' ? 'en' : null), setItem() {} };
    globalThis.localStorage = fakeStorage;
    try {
      const fresh = await withNavigatorLanguage('es-ES', () => import('../src/i18n/strings.js?fresh-saved-pref'));
      assert.equal(fresh.getLang(), 'en');
    } finally {
      delete globalThis.localStorage;
    }
  });
});

describe('t', () => {
  test('substitutes every {token} from vars, nothing left over', () => {
    setLang('en');
    assert.equal(t('guideListItem', { label: 'Bridge', count: 6 }), 'Bridge — 6 points');
  });

  test('a key with no vars renders as-is', () => {
    setLang('en');
    assert.equal(t('closeButton'), 'Close');
  });

  test('an unknown key renders as the key itself, never throws', () => {
    assert.equal(t('this-key-does-not-exist'), 'this-key-does-not-exist');
  });
});

describe('setLang / getLang', () => {
  test('setLang ignores anything that is not en/es', () => {
    setLang('es');
    setLang('fr');
    assert.equal(getLang(), 'es');
    setLang('en');
  });

  test('en and es define exactly the same set of keys — neither leads', () => {
    const en = keysFor('en');
    const es = keysFor('es');
    assert.ok(en.length > 0, 'en table is empty');
    const missingFromEs = en.filter((k) => !hasOwnKey('es', k));
    const missingFromEn = es.filter((k) => !hasOwnKey('en', k));
    assert.deepEqual(missingFromEs, [], `es is missing keys en has: ${missingFromEs.join(', ')}`);
    assert.deepEqual(missingFromEn, [], `en is missing keys es has: ${missingFromEn.join(', ')}`);
  });
});

// LOTE 5 §5: index.html marks every chrome text node with data-i18n(-html)="key" instead of
// writing it in the markup — applyStrings() (src/ui/app.js) fills it in at boot. A key referenced
// there but missing from strings.js would silently render the raw key name on screen; this test
// catches that the same way dryland-test-logger's own tools/test.mjs §9 catches a stray Spanish
// literal in app.js — read the real file, not a copy of it.
describe('index.html data-i18n coverage', () => {
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]);

  test('index.html actually uses data-i18n attributes (this test is not vacuous)', () => {
    assert.ok(keys.length > 10, `only found ${keys.length} data-i18n keys`);
  });

  test('every data-i18n key in index.html exists in both language tables', () => {
    for (const key of keys) {
      assert.ok(hasOwnKey('en', key), `en is missing "${key}" (used in index.html)`);
      assert.ok(hasOwnKey('es', key), `es is missing "${key}" (used in index.html)`);
    }
  });
});

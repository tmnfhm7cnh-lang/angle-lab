import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeReturnUrl } from '../src/core/returnUrl.js';

const ORIGIN = 'https://tmnfhm7cnh-lang.github.io';

describe('isSafeReturnUrl', () => {
  test('rejects javascript:, data:, a foreign origin and an empty string', () => {
    assert.equal(isSafeReturnUrl('javascript:alert(1)//', ORIGIN), false);
    assert.equal(isSafeReturnUrl('data:text/html,x', ORIGIN), false);
    assert.equal(isSafeReturnUrl('https://evil.example/x', ORIGIN), false);
    assert.equal(isSafeReturnUrl('', ORIGIN), false);
  });

  test('rejects values that are not absolute URLs, and non-strings', () => {
    assert.equal(isSafeReturnUrl('not a url', ORIGIN), false);
    assert.equal(isSafeReturnUrl('/relative/path', ORIGIN), false);
    assert.equal(isSafeReturnUrl(null, ORIGIN), false);
    assert.equal(isSafeReturnUrl(undefined, ORIGIN), false);
  });

  test('accepts the same origin', () => {
    assert.equal(isSafeReturnUrl(`${ORIGIN}/dryland-test-logger/`, ORIGIN), true);
  });

  test('accepts localhost and 127.0.0.1 on any port', () => {
    assert.equal(isSafeReturnUrl('http://localhost:8090/', ORIGIN), true);
    assert.equal(isSafeReturnUrl('http://127.0.0.1:8090/x', ORIGIN), true);
  });

  test('rejects a lookalike host that merely contains localhost or the origin', () => {
    assert.equal(isSafeReturnUrl('https://localhost.evil.example/', ORIGIN), false);
    assert.equal(isSafeReturnUrl(`${ORIGIN}.evil.example/`, ORIGIN), false);
    assert.equal(isSafeReturnUrl('https://evil.example/?u=http://localhost/', ORIGIN), false);
  });
});

// The PHP contact handler, end to end with PHP's built-in server and a fake sendmail.
// Skipped when php is not installed. The unit tests live in tests/contact_test.php.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hasPhp = spawnSync('php', ['-v']).status === 0;
const SEND = new URL('../public/contact/send.php', import.meta.url).pathname;
const TO = 'owner-inbox@example.test';

test('send.php passes php -l and its unit tests', { skip: !hasPhp }, () => {
  assert.equal(spawnSync('php', ['-l', SEND]).status, 0);
  const r = spawnSync('php', [new URL('./contact_test.php', import.meta.url).pathname], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

async function withServer(withConfig, fn) {
  const base = mkdtempSync(join(tmpdir(), 'cr-contact-'));
  const docroot = join(base, 'public_html');
  mkdirSync(join(docroot, 'contact'), { recursive: true });
  copyFileSync(SEND, join(docroot, 'contact/send.php'));
  if (withConfig) writeFileSync(join(base, 'crystal-contact-config.php'), `<?php return ['to' => '${TO}', 'from' => 'contact@crystalandritual.com'];\n`);
  const mailFile = join(base, 'mail.eml');
  // A fake sendmail that accepts sendmail's arguments (such as -f) and keeps the message.
  const fake = join(base, 'fake-sendmail.sh');
  writeFileSync(fake, `#!/bin/sh\ncat >> '${mailFile}'\n`, { mode: 0o755 });
  const port = 18000 + Math.floor(Math.random() * 2000);
  const proc = spawn('php', ['-d', `sendmail_path=${fake}`, '-S', `127.0.0.1:${port}`, '-t', docroot], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try { await fetch(`http://127.0.0.1:${port}/contact/send.php`, { redirect: 'manual' }); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    await fn({ url: `http://127.0.0.1:${port}/contact/send.php`, mailFile, base });
  } finally {
    proc.kill();
    rmSync(base, { recursive: true, force: true });
  }
}

const form = (over = {}) => new URLSearchParams({ name: 'Ada', email: 'ada@example.com', topic: 'question', page: '', message: 'Hello there', website: '', ts: String(Date.now() - 10000), ...over });
const post = (url, body) => fetch(url, { method: 'POST', body, redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

test('a good message is mailed and redirects to the thanks page', { skip: !hasPhp }, async () => {
  await withServer(true, async ({ url, mailFile }) => {
    const r = await post(url, form());
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), '/contact/thanks/');
    assert.equal(r.headers.get('set-cookie'), null);
    const text = await r.text();
    assert.doesNotMatch(text + JSON.stringify([...r.headers]), new RegExp(TO));
    const mail = readFileSync(mailFile, 'utf8');
    assert.match(mail, /Hello there/);
    assert.match(mail, /Reply-To: ada@example\.com/);
  });
});

test('failures go back to the form, the honeypot looks like a success', { skip: !hasPhp }, async () => {
  await withServer(true, async ({ url, mailFile }) => {
    const fast = await post(url, form({ ts: String(Date.now()) }));
    assert.equal(fast.headers.get('location'), '/contact/?error=1');
    const bad = await post(url, form({ email: 'nope' }));
    assert.equal(bad.headers.get('location'), '/contact/?error=1');
    const bot = await post(url, form({ website: 'http://spam.test' }));
    assert.equal(bot.headers.get('location'), '/contact/thanks/');
    assert.equal(existsSync(mailFile), false, 'nothing was mailed');
    const get = await fetch(url, { redirect: 'manual' });
    assert.equal(get.headers.get('location'), '/contact/');
  });
});

test('the sixth message in an hour is refused', { skip: !hasPhp }, async () => {
  await withServer(true, async ({ url, base }) => {
    const locations = [];
    for (let i = 0; i < 6; i++) locations.push((await post(url, form())).headers.get('location'));
    assert.deepEqual(locations.slice(0, 5), Array(5).fill('/contact/thanks/'));
    assert.equal(locations[5], '/contact/?error=1');
    assert.equal(existsSync(join(base, 'crystal-contact-ratelimit')), true, 'the store sits outside the web root');
  });
});

test('without the config file the form answers 503 and reveals nothing', { skip: !hasPhp }, async () => {
  await withServer(false, async ({ url }) => {
    const r = await post(url, form());
    assert.equal(r.status, 503);
    const body = await r.text();
    assert.match(body, /The Contact Form Is Resting/);
    assert.doesNotMatch(body, /@/);
  });
});

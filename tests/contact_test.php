<?php
// Unit tests for public/contact/send.php, run with  php tests/contact_test.php
declare(strict_types=1);
define('CR_CONTACT_TEST', true);
require __DIR__ . '/../public/contact/send.php';

$fails = 0;
function check(string $name, bool $ok): void { global $fails; echo ($ok ? 'ok   ' : 'FAIL ') . $name . "\n"; if (!$ok) $fails++; }

$now = 1765000000;
$good = ['name' => '  Ada  ', 'email' => ' ada@example.com ', 'topic' => 'correction', 'page' => 'https://crystalandritual.com/stones/amethyst/', 'message' => "Line one\r\nLine two", 'website' => '', 'ts' => (string)(($now - 10) * 1000)];

$r = cr_validate($good, $now);
check('a good message passes', $r['ok'] === true);
check('fields are trimmed', $r['data']['name'] === 'Ada' && $r['data']['email'] === 'ada@example.com');
check('the topic key maps to its label', $r['data']['topic'] === 'A Correction');
check('message newlines are normalized', $r['data']['message'] === "Line one\nLine two");
check('honeypot is rejected', cr_validate(array_merge($good, ['website' => 'http://spam']), $now)['reason'] === 'honeypot');
check('under 3 seconds is rejected', cr_validate(array_merge($good, ['ts' => (string)(($now - 2) * 1000)]), $now)['reason'] === 'too_fast');
check('exactly 3 seconds passes', cr_validate(array_merge($good, ['ts' => (string)(($now - 3) * 1000)]), $now)['ok'] === true);
check('a missing timestamp is rejected', cr_validate(array_merge($good, ['ts' => '']), $now)['reason'] === 'timestamp');
check('a timestamp from the future is rejected', cr_validate(array_merge($good, ['ts' => (string)(($now + 60) * 1000)]), $now)['reason'] === 'too_fast');
check('a stale page is rejected', cr_validate(array_merge($good, ['ts' => (string)(($now - 700000) * 1000)]), $now)['reason'] === 'stale');
check('a bad email is rejected', cr_validate(array_merge($good, ['email' => 'not-an-email']), $now)['reason'] === 'email');
check('an email with a header injection is rejected', cr_validate(array_merge($good, ['email' => "ada@example.com\r\nBcc: x@evil.test"]), $now)['ok'] === false);
check('an unknown topic is rejected', cr_validate(array_merge($good, ['topic' => 'sales']), $now)['reason'] === 'topic');
check('a non http page is rejected', cr_validate(array_merge($good, ['page' => 'javascript:alert(1)']), $now)['reason'] === 'page');
check('an empty page is fine', cr_validate(array_merge($good, ['page' => '']), $now)['ok'] === true);
check('an empty message is rejected', cr_validate(array_merge($good, ['message' => '   ']), $now)['reason'] === 'message');
check('the message is capped at 5000 characters', mb_strlen(cr_validate(array_merge($good, ['message' => str_repeat('a', 9000)]), $now)['data']['message']) === 5000);
check('non string input does not crash', cr_validate(array_merge($good, ['name' => ['x']]), $now)['data']['name'] === '');

check('CR and LF are stripped from header values', cr_header_value("Ada\r\nBcc: x@evil.test") === 'Ada Bcc: x@evil.test');
$mail = cr_build_mail(array_merge($r['data'], ['name' => "Ada\nBcc: x@evil.test"]), 'contact@crystalandritual.com');
$noBreaks = true;
foreach ($mail['headers'] as $v) { if (preg_match("/[\r\n]/", $v)) $noBreaks = false; }
check('no header value holds a line break', $noBreaks);
check('reply-to is the sender', $mail['headers']['Reply-To'] === 'ada@example.com');
check('the body carries the message', str_contains($mail['body'], "Line one\nLine two"));

$dir = sys_get_temp_dir() . '/cr-rate-' . bin2hex(random_bytes(4));
$okCount = 0;
for ($i = 0; $i < 7; $i++) { if (cr_rate_limit_ok($dir, '203.0.113.9', $now + $i)) $okCount++; }
check('5 messages per IP per hour', $okCount === 5);
check('another IP is not limited', cr_rate_limit_ok($dir, '203.0.113.10', $now));
check('the limit lifts after an hour', cr_rate_limit_ok($dir, '203.0.113.9', $now + 3700));
$files = glob($dir . '/*.json');
check('IPs are stored hashed, never in clear', !str_contains(implode('', array_map('file_get_contents', $files)) . implode('', $files), '203.0.113'));
array_map('unlink', $files); @rmdir($dir);

echo $fails ? "$fails failed\n" : "all passed\n";
exit($fails ? 1 : 0);

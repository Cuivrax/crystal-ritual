<?php
/*
 * Crystal & Ritual contact form handler (o2switch, Apache with PHP).
 *
 * The form on /contact/ posts here. This script
 *   - accepts POST only, sets no cookie and calls no third-party service,
 *   - trims and validates every field, rejects the honeypot and any send made
 *     less than 3 seconds after the page loaded,
 *   - allows 5 messages per IP and per hour (hashed IPs in a small file store
 *     outside the web root),
 *   - strips CR and LF from every header value,
 *   - sends with PHP mail() to the address read from a config file outside the web root
 *       dirname($_SERVER['DOCUMENT_ROOT']) . '/crystal-contact-config.php'
 *     which returns ['to' => 'inbox address', 'from' => 'sender address on the site domain'].
 * The recipient address is never written in this file, in the site HTML or in any response.
 * Success goes to /contact/thanks/, a failure back to /contact/?error=1.
 */
declare(strict_types=1);

const CR_MIN_SECONDS = 3;
const CR_MAX_AGE_SECONDS = 604800;        // a page left open for a week is still fine
const CR_RATE_LIMIT = 5;                  // messages
const CR_RATE_WINDOW = 3600;              // per hour
const CR_TOPICS = ['correction' => 'A Correction', 'question' => 'A Question', 'other' => 'Something Else'];

/** Removes CR, LF and other control characters from a header value. */
function cr_header_value(string $value): string
{
    $value = str_replace(["\r", "\n", "\0"], ' ', $value);
    $value = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value) ?? '';
    return trim(preg_replace('/\s{2,}/u', ' ', $value) ?? '');
}

/** Trims a text field and caps its length. Keeps newlines (for the message body). */
function cr_clean_text($value, int $max, bool $multiline = false): string
{
    $value = is_string($value) ? $value : '';
    if (!mb_check_encoding($value, 'UTF-8')) {
        $value = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
    }
    $value = str_replace("\0", '', $value);
    if ($multiline) {
        $value = str_replace(["\r\n", "\r"], "\n", $value);
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    } else {
        $value = cr_header_value($value);
    }
    $value = trim($value);
    return mb_substr($value, 0, $max);
}

/**
 * Validates a submission. $post is the raw $_POST array, $now the current Unix time.
 * Returns ['ok' => true, 'data' => [...]] or ['ok' => false, 'reason' => 'code'].
 */
function cr_validate(array $post, int $now): array
{
    if (trim((string)($post['website'] ?? '')) !== '') {
        return ['ok' => false, 'reason' => 'honeypot'];
    }
    $ts = (string)($post['ts'] ?? '');
    if (!preg_match('/^\d{10,14}$/', $ts)) {
        return ['ok' => false, 'reason' => 'timestamp'];
    }
    $loaded = intdiv((int)$ts, strlen($ts) >= 13 ? 1000 : 1); // milliseconds from the page script
    $elapsed = $now - $loaded;
    if ($elapsed < CR_MIN_SECONDS) {
        return ['ok' => false, 'reason' => 'too_fast'];
    }
    if ($elapsed > CR_MAX_AGE_SECONDS) {
        return ['ok' => false, 'reason' => 'stale'];
    }

    $name = cr_clean_text($post['name'] ?? '', 100);
    $email = cr_clean_text($post['email'] ?? '', 254);
    $topicKey = cr_clean_text($post['topic'] ?? '', 20);
    $page = cr_clean_text($post['page'] ?? '', 300);
    $message = cr_clean_text($post['message'] ?? '', 5000, true);

    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        return ['ok' => false, 'reason' => 'email'];
    }
    if (!array_key_exists($topicKey, CR_TOPICS)) {
        return ['ok' => false, 'reason' => 'topic'];
    }
    if ($page !== '' && (filter_var($page, FILTER_VALIDATE_URL) === false || !preg_match('#^https?://#i', $page))) {
        return ['ok' => false, 'reason' => 'page'];
    }
    if (mb_strlen($message) < 2) {
        return ['ok' => false, 'reason' => 'message'];
    }
    return ['ok' => true, 'data' => [
        'name' => $name,
        'email' => $email,
        'topic' => CR_TOPICS[$topicKey],
        'page' => $page,
        'message' => $message,
    ]];
}

/**
 * Counts this IP's recent sends and records a new one when allowed.
 * IPs are stored as salted SHA-256 hashes, one small file per IP, outside the web root.
 */
function cr_rate_limit_ok(string $dir, string $ip, int $now): bool
{
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return true; // no store, no limit, better than refusing every message
    }
    $file = $dir . '/' . hash('sha256', 'crystal-ritual|' . $ip) . '.json';
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return true;
    }
    try {
        flock($fh, LOCK_EX);
        $raw = stream_get_contents($fh);
        $times = json_decode($raw !== false && $raw !== '' ? $raw : '[]', true);
        $times = array_values(array_filter(is_array($times) ? $times : [], static fn($t) => is_int($t) && $t > $now - CR_RATE_WINDOW));
        if (count($times) >= CR_RATE_LIMIT) {
            return false;
        }
        $times[] = $now;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($times));
        return true;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

/** Builds the mail parts. All header values go through cr_header_value(). */
function cr_build_mail(array $data, string $from): array
{
    $subject = cr_header_value('Crystal & Ritual contact, ' . $data['topic']);
    $lines = [
        'Topic, ' . $data['topic'],
        'Name, ' . ($data['name'] !== '' ? $data['name'] : 'not given'),
        'Email, ' . $data['email'],
        'Page, ' . ($data['page'] !== '' ? $data['page'] : 'not given'),
        '',
        $data['message'],
    ];
    $headers = [
        'From' => cr_header_value('Crystal & Ritual <' . $from . '>'),
        'Reply-To' => cr_header_value($data['email']),
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => '8bit',
        'X-Mailer' => 'crystalandritual.com contact form',
    ];
    return [
        'subject' => function_exists('mb_encode_mimeheader') ? mb_encode_mimeheader($subject, 'UTF-8', 'Q') : $subject,
        'body' => implode("\n", $lines) . "\n",
        'headers' => $headers,
    ];
}

function cr_redirect(string $path): void
{
    header('Location: ' . $path, true, 303);
    header('Cache-Control: no-store');
    exit;
}

function cr_unavailable(): void
{
    http_response_code(503);
    header('Content-Type: text/html; charset=UTF-8');
    header('Retry-After: 3600');
    header('Cache-Control: no-store');
    echo '<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex"><title>Contact Form Resting | Crystal &amp; Ritual</title>'
        . '<style>body{margin:0;background:#FBFAF8;color:#2B2537;font:18px/1.6 system-ui,sans-serif}main{max-width:560px;margin:15vh auto;padding:0 24px;text-align:center}'
        . 'h1{font:400 40px/1.1 Georgia,serif}a{color:#5B4B88}</style></head><body><main><h1>The Contact Form Is Resting</h1>'
        . '<p>Your message could not be sent right now. Please try again a little later.</p><p><a href="/contact/">Back to the Contact Page</a></p></main></body></html>';
    exit;
}

function cr_main(): void
{
    header('X-Robots-Tag: noindex, nofollow');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        cr_redirect('/contact/');
    }
    $base = dirname((string)($_SERVER['DOCUMENT_ROOT'] ?? __DIR__ . '/..'));
    $configFile = $base . '/crystal-contact-config.php';
    if (!is_file($configFile)) {
        cr_unavailable();
    }
    $config = include $configFile;
    $to = is_array($config) ? cr_header_value((string)($config['to'] ?? '')) : '';
    $from = is_array($config) ? cr_header_value((string)($config['from'] ?? '')) : '';
    if (filter_var($to, FILTER_VALIDATE_EMAIL) === false || filter_var($from, FILTER_VALIDATE_EMAIL) === false) {
        cr_unavailable();
    }

    $now = time();
    $result = cr_validate($_POST, $now);
    if (!$result['ok']) {
        // A bot that filled the honeypot gets the same answer as a person, nothing to learn from it.
        cr_redirect($result['reason'] === 'honeypot' ? '/contact/thanks/' : '/contact/?error=1');
    }
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (!cr_rate_limit_ok($base . '/crystal-contact-ratelimit', $ip, $now)) {
        cr_redirect('/contact/?error=1');
    }
    $mail = cr_build_mail($result['data'], $from);
    $headerLines = [];
    foreach ($mail['headers'] as $k => $v) {
        $headerLines[] = $k . ': ' . $v;
    }
    $sent = @mail($to, $mail['subject'], $mail['body'], implode("\r\n", $headerLines), '-f' . $from);
    cr_redirect($sent ? '/contact/thanks/' : '/contact/?error=1');
}

if (!defined('CR_CONTACT_TEST')) {
    cr_main();
}

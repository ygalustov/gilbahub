<?php

use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

if (! defined('ABSPATH')) {
    define('ABSPATH', base_path().DIRECTORY_SEPARATOR);
}

if (! defined('CAL_GREGORIAN')) {
    define('CAL_GREGORIAN', 0);
}

if (! class_exists('WP_Error')) {
    class WP_Error
    {
        public function __construct(
            protected string $code = 'error',
            protected string $message = '',
            protected mixed $data = null
        ) {
        }

        public function get_error_code(): string
        {
            return $this->code;
        }

        public function get_error_message(): string
        {
            return $this->message;
        }

        public function get_error_data(): mixed
        {
            return $this->data;
        }
    }
}

if (! function_exists('is_wp_error')) {
    function is_wp_error(mixed $value): bool
    {
        return $value instanceof WP_Error;
    }
}

if (! function_exists('wp_json_encode')) {
    function wp_json_encode(mixed $value, int $flags = 0, int $depth = 512): string|false
    {
        return json_encode($value, $flags, $depth);
    }
}

if (! function_exists('wp_parse_args')) {
    function wp_parse_args(mixed $args, array $defaults = []): array
    {
        if (is_object($args)) {
            $args = get_object_vars($args);
        } elseif (! is_array($args)) {
            parse_str((string) $args, $args);
        }

        return array_merge($defaults, is_array($args) ? $args : []);
    }
}

if (! function_exists('esc_html')) {
    function esc_html(mixed $text): string
    {
        return htmlspecialchars((string) $text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (! function_exists('esc_attr')) {
    function esc_attr(mixed $text): string
    {
        return htmlspecialchars((string) $text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (! function_exists('__')) {
    function __(string $text, ?string $domain = null): string
    {
        return $text;
    }
}

if (! function_exists('esc_html__')) {
    function esc_html__(string $text, ?string $domain = null): string
    {
        return esc_html($text);
    }
}

if (! function_exists('esc_attr__')) {
    function esc_attr__(string $text, ?string $domain = null): string
    {
        return esc_attr($text);
    }
}

if (! function_exists('sanitize_key')) {
    function sanitize_key(mixed $key): string
    {
        $key = strtolower((string) $key);

        return preg_replace('/[^a-z0-9_\-]/', '', $key) ?? '';
    }
}

if (! function_exists('sanitize_text_field')) {
    function sanitize_text_field(mixed $value): string
    {
        if (is_array($value) || is_object($value)) {
            return '';
        }

        $value = strip_tags((string) $value);
        $value = preg_replace('/[\r\n\t ]+/', ' ', $value) ?? $value;

        return trim($value);
    }
}

if (! function_exists('sanitize_title')) {
    function sanitize_title(mixed $title): string
    {
        $title = strtolower(sanitize_text_field($title));
        $title = preg_replace('/[^a-z0-9]+/', '-', $title) ?? $title;

        return trim($title, '-');
    }
}

if (! function_exists('current_time')) {
    function current_time(string $type = 'mysql'): string|int
    {
        $now = Carbon::now(config('app.timezone'));

        return match ($type) {
            'mysql' => $now->format('Y-m-d H:i:s'),
            'timestamp' => $now->getTimestamp(),
            'c' => $now->toAtomString(),
            default => $now->format($type),
        };
    }
}

if (! function_exists('get_option')) {
    function get_option(string $key, mixed $default = false): mixed
    {
        return Cache::get('legacy_wp_option:'.$key, $default);
    }
}

if (! function_exists('update_option')) {
    function update_option(string $key, mixed $value): bool
    {
        Cache::forever('legacy_wp_option:'.$key, $value);

        return true;
    }
}

if (! function_exists('delete_option')) {
    function delete_option(string $key): bool
    {
        return Cache::forget('legacy_wp_option:'.$key);
    }
}

if (! function_exists('get_transient')) {
    function get_transient(string $key): mixed
    {
        return Cache::get('legacy_wp_transient:'.$key, false);
    }
}

if (! function_exists('set_transient')) {
    function set_transient(string $key, mixed $value, int $ttl): bool
    {
        Cache::put('legacy_wp_transient:'.$key, $value, $ttl);

        return true;
    }
}

if (! function_exists('delete_transient')) {
    function delete_transient(string $key): bool
    {
        return Cache::forget('legacy_wp_transient:'.$key);
    }
}

if (! function_exists('wp_remote_post')) {
    function wp_remote_post(string $url, array $args = []): array|WP_Error
    {
        try {
            $timeout = (int) ($args['timeout'] ?? 30);
            $headers = is_array($args['headers'] ?? null) ? $args['headers'] : [];
            $body = $args['body'] ?? null;

            $client = Http::timeout($timeout)->withHeaders($headers);
            $response = is_string($body)
                ? $client->send('POST', $url, ['body' => $body])
                : $client->post($url, is_array($body) ? $body : []);

            return [
                'response' => [
                    'code' => $response->status(),
                ],
                'body' => $response->body(),
            ];
        } catch (Throwable $e) {
            return new WP_Error('http_request_failed', $e->getMessage());
        }
    }
}

if (! function_exists('wp_remote_retrieve_response_code')) {
    function wp_remote_retrieve_response_code(array $response): int
    {
        return (int) ($response['response']['code'] ?? 0);
    }
}

if (! function_exists('wp_remote_retrieve_body')) {
    function wp_remote_retrieve_body(array $response): string
    {
        return (string) ($response['body'] ?? '');
    }
}

if (! function_exists('cal_days_in_month')) {
    function cal_days_in_month(int $calendar, int $month, int $year): int
    {
        return Carbon::create($year, $month, 1, 0, 0, 0, config('app.timezone'))->daysInMonth;
    }
}

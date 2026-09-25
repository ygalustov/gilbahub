<?php

namespace Tests\Support;

use FilesystemIterator;
use RecursiveCallbackFilterIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * GH-716 (queue item 3shch, place 3 of the plan) — A PHPUNIT RUN SAYS WHICH TREE IT SAW.
 *
 * The Jest half is `tests/lib/tree-fingerprint.js` and this is its other half. The three
 * corrections that shaped that one hold here too:
 *
 *  1. THE WHOLE TREE MINUS DECLARED EXCLUSIONS, never a list of folders — a list lets a new
 *     folder fall out in silence. The exclusions are named below and printed with the number.
 *  2. CONTENT ALONE ANSWERS THE WRONG QUESTION. A hash at each end cannot see an edit made and
 *     reverted inside the run — a reviewer's mutation, the thing this exists for. That move is
 *     seen by `ctime`, which a revert does not put back.
 *  3. WHERE IT IS PRINTED is the caller's business: the verdict has to be the LAST line and the
 *     exit code non-zero, which is what the bootstrap beside this file arranges.
 *
 * WHAT THE UNIVERSE IS HERE, AND WHY IT IS NOT THE SAME TREE AS JEST'S. This process runs in
 * the container, where only two paths of the repository are mounted: `/var/www/html` (the Laravel
 * app) and `/var/www/assets`. The root is therefore the PARENT of `base_path()` — everything the
 * process can reach — rather than a list of directories, and it is discovered, not written down.
 * The repository's own `tests/`, `docs/`, `files/` and root config are NOT visible from here, so
 * this fingerprint and the Jest one describe different trees and their hashes are not comparable.
 * That is stated rather than hidden: each print names its root.
 *
 * `.phpunit.result.cache` IS EXCLUDED FROM MEASUREMENT, not from opinion. Measured before writing
 * this: a run of one class moved exactly one file in the whole universe, and it was that cache.
 * A mark that fires on every run stops being read.
 */
class TreeFingerprint
{
    /** Declared, and printed with every fingerprint, so the boundary travels with the number. */
    public const EXCLUDED_DIRS = [
        'node_modules', 'vendor', '.git', 'storage', 'dist', 'coverage', '.idea', '.vscode',
        // The live documents are written all day by whoever is on shift; they are not the product.
        'files',
    ];

    /** Files the run writes itself. Measured, not assumed — see the class comment. */
    public const EXCLUDED_FILES = [
        '.phpunit.result.cache',
    ];

    /** Everything this process can reach: the parent of the app, discovered rather than listed. */
    public static function root(): string
    {
        return dirname(self::appPath());
    }

    private static function appPath(): string
    {
        // `base_path()` is not available while the bootstrap runs, so the app root is taken from
        // this file's own place instead: tests/Support/ -> tests/ -> the app.
        return dirname(dirname(__DIR__));
    }

    /**
     * @return array{hash: string, newestCtime: int, files: int, root: string, excluded: array<int, string>}
     *   `hash` is of the CONTENT of every file; `newestCtime` is what a revert cannot put back.
     */
    public static function take(): array
    {
        $root = self::root();
        $files = self::walk($root);
        sort($files);

        $sum = hash_init('sha256');
        $newest = 0;
        foreach ($files as $rel) {
            hash_update($sum, $rel);
            hash_update($sum, "\0");
            $full = $root.DIRECTORY_SEPARATOR.$rel;
            $body = @file_get_contents($full);
            hash_update($sum, $body === false ? '<unreadable>' : $body);
            hash_update($sum, "\0");
            $ctime = @filectime($full);
            if ($ctime !== false && $ctime > $newest) {
                $newest = $ctime;
            }
        }

        return [
            'hash' => substr(hash_final($sum), 0, 16),
            'newestCtime' => $newest,
            'files' => count($files),
            'root' => $root,
            'excluded' => array_merge(self::EXCLUDED_DIRS, self::EXCLUDED_FILES),
        ];
    }

    /** @return array<int, string> paths relative to the root */
    private static function walk(string $root): array
    {
        if (! is_dir($root)) {
            return [];
        }
        $out = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveCallbackFilterIterator(
                new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
                static function ($current): bool {
                    if ($current->isDir()) {
                        return ! in_array($current->getFilename(), self::EXCLUDED_DIRS, true);
                    }

                    return ! in_array($current->getFilename(), self::EXCLUDED_FILES, true);
                }
            ),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($iterator as $entry) {
            if (! $entry->isFile()) {
                continue;
            }
            $out[] = ltrim(substr($entry->getPathname(), strlen($root)), DIRECTORY_SEPARATOR);
        }

        return $out;
    }

    /** The one sentence a run prints about the tree it saw. */
    public static function line(string $stage, array $fingerprint): string
    {
        return '[tree] '.$fingerprint['hash'].' '.$stage
            .' | files '.$fingerprint['files']
            .' | root '.$fingerprint['root']
            .' | newest ctime '.gmdate('Y-m-d\TH:i:s\Z', $fingerprint['newestCtime'])
            .' | excluded '.json_encode($fingerprint['excluded']);
    }

    /**
     * `null` when the run describes one tree; otherwise the sentence that must be printed LAST,
     * with a non-zero exit code beside it.
     */
    public static function verdict(array $before, array $after): ?string
    {
        if ($before['hash'] !== $after['hash']) {
            return 'TREE MOVED DURING RUN: content changed, '.$before['hash'].' -> '.$after['hash']
                .' (this run is not valid; nothing it printed describes one tree)';
        }
        if ($after['newestCtime'] > $before['newestCtime']) {
            return 'TREE MOVED DURING RUN: content is back but a file was touched at '
                .gmdate('Y-m-d\TH:i:s\Z', $after['newestCtime'])
                .' (an edit made and reverted inside the run; this run is not valid)';
        }

        return null;
    }
}

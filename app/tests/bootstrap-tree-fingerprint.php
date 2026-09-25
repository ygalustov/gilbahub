<?php

/**
 * GH-716 (queue item 3shch, place 3 of the plan) — THE FIRST AND LAST LINES OF A PHPUNIT RUN.
 *
 * NOT CONNECTED. This file replaces `vendor/autoload.php` as the bootstrap; the exact line is
 * named in the queue item and is not applied, by the coordinator's decision: the tree moves by
 * design during a working night, and a mark that fires every time stops being read.
 *
 * WHY A SHUTDOWN FUNCTION AND NOT A PHPUNIT EXTENSION. The verdict has to be the LAST line a
 * reader sees, after PHPUnit's own summary, and it has to carry a non-zero exit code. Measured
 * rather than assumed: an extension's `Application\Finished` still runs before the summary is
 * flushed in this version, and an exception thrown from a hook is reported by PHPUnit as an
 * error inside its own machinery rather than as a failed run. `register_shutdown_function` runs
 * after everything PHPUnit prints, and `exit(1)` inside it sets the code of the process.
 *
 * THE START READING IS TAKEN HERE, at bootstrap, which is before the first test and after the
 * autoloader — the earliest moment this process can read the tree at all.
 */

require __DIR__.'/../vendor/autoload.php';

require_once __DIR__.'/Support/TreeFingerprint.php';

$gh716Start = \Tests\Support\TreeFingerprint::take();
fwrite(STDOUT, \Tests\Support\TreeFingerprint::line('start', $gh716Start)."\n");

register_shutdown_function(static function () use ($gh716Start): void {
    $end = \Tests\Support\TreeFingerprint::take();
    fwrite(STDOUT, "\n".\Tests\Support\TreeFingerprint::line('end', $end)."\n");

    $said = \Tests\Support\TreeFingerprint::verdict($gh716Start, $end);
    if ($said !== null) {
        fwrite(STDOUT, $said."\n");
        // A run whose tree moved must not leave a zero exit code behind it. This is the only
        // way to change the code from a shutdown handler, and it is after all output.
        exit(1);
    }
});

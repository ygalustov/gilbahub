<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use Tests\Support\TreeFingerprint;

/**
 * GH-716 (queue item 3shch, place 3) — THE PHPUNIT HALF OF THE FINGERPRINT.
 *
 * The verdict is a pure function of two readings, so it is measured on readings built here; the
 * reading itself is measured against the real tree, read-only. The one case that does write is
 * the one that PROVES a boundary rather than a promise, and it writes a file it declares by name,
 * inside a single run, into a directory of fixtures.
 */
class Gh716TreeFingerprintTest extends TestCase
{
    public function test_a_reading_names_its_root_its_size_and_its_exclusions(): void
    {
        $fingerprint = TreeFingerprint::take();
        fwrite(STDOUT, "\n".TreeFingerprint::line('probe', $fingerprint)."\n");

        // A fingerprint over nothing would agree with itself forever; the size is the positive
        // control, and the root is printed because this container sees only part of the tree.
        $this->assertGreaterThan(100, $fingerprint['files']);
        $this->assertSame(16, strlen($fingerprint['hash']));
        $this->assertGreaterThan(0, $fingerprint['newestCtime']);
        $this->assertContains('vendor', $fingerprint['excluded']);
        $this->assertContains('.phpunit.result.cache', $fingerprint['excluded']);
    }

    public function test_content_that_changed_is_named_with_both_hashes(): void
    {
        $before = ['hash' => 'aaaaaaaaaaaaaaaa', 'newestCtime' => 1000, 'files' => 10, 'root' => '/x', 'excluded' => []];
        $after = ['hash' => 'bbbbbbbbbbbbbbbb', 'newestCtime' => 1000, 'files' => 10, 'root' => '/x', 'excluded' => []];

        $said = TreeFingerprint::verdict($before, $after);
        fwrite(STDOUT, '[gh716] verdict: '.json_encode($said)."\n");

        $this->assertNotNull($said);
        $this->assertStringContainsString('TREE MOVED DURING RUN', $said);
        $this->assertStringContainsString('aaaaaaaaaaaaaaaa -> bbbbbbbbbbbbbbbb', $said);
    }

    public function test_an_edit_made_and_reverted_inside_the_run_is_caught_by_ctime(): void
    {
        // The case the whole item exists for: the content is back, so a content hash says the
        // tree never moved. `ctime` is what a revert cannot put back.
        $before = ['hash' => 'aaaaaaaaaaaaaaaa', 'newestCtime' => 1000, 'files' => 10, 'root' => '/x', 'excluded' => []];
        $after = ['hash' => 'aaaaaaaaaaaaaaaa', 'newestCtime' => 2000, 'files' => 10, 'root' => '/x', 'excluded' => []];

        $said = TreeFingerprint::verdict($before, $after);
        fwrite(STDOUT, '[gh716] content is back: '.json_encode($before['hash'] === $after['hash'])
            .' | verdict: '.json_encode($said)."\n");

        $this->assertNotNull($said);
        $this->assertStringContainsString('content is back', $said);
    }

    public function test_an_edit_made_and_reverted_is_caught_ON_A_REAL_TREE_not_on_numbers_this_file_wrote(): void
    {
        /**
         * GH-716 (the reviewer's return) — THE READING COMES FROM THE TREE, NOT FROM THIS FILE.
         *
         * The case above hands `verdict()` a `newestCtime` of 1000 and then 2000, both written
         * here. `take()` never runs, so nothing says the number it reports is the NEWEST ctime
         * rather than the oldest, or the first one it happened to see. Measured by the reviewer of
         * this item: make `take()` return the OLDEST ctime and the whole set stays green, 5 of 5.
         *
         * So this one edits a real file under the real root, puts the content back, and asks
         * `take()` twice. The probe is created and deleted inside this case; it is named in the
         * output either way.
         *
         * THE SECOND OF WAITING is the price of the measurement, not an oversight: `ctime` has a
         * one-second resolution, so an edit and its revert inside the same second leave the number
         * where it was — which is a true statement about the filesystem and would make this case
         * assert nothing.
         *
         * GH-716 (the acceptor's return) — AND THE REVERT PUTS THE MTIME BACK, WHICH IS THE WHOLE
         * CLAIM. The first version reverted with `file_put_contents` alone, and that moves `mtime`
         * and `ctime` together: measured by the acceptor, reading `filemtime` in place of
         * `filectime` left this file green, 6 of 6. So the case could not tell the two apart, and
         * "a revert cannot put `ctime` back" — the sentence the item exists for — was not being
         * asserted at all.
         *
         * `touch()` with the original modification time is what separates them: `mtime` goes back
         * to the number it had, `ctime` cannot, because changing the timestamps is itself a change
         * to the inode. Both are read here and both are printed, so the red says which one moved.
         *
         * THE BOUNDARY, named rather than left: neither `take()` nor the bootstrap's hook clears
         * PHP's stat cache. This case calls `clearstatcache()` itself, so a caller that does not
         * may read a number this case never saw.
         */
        $root = TreeFingerprint::root();
        $probe = $root.DIRECTORY_SEPARATOR.'html'.DIRECTORY_SEPARATOR.'tests'
            .DIRECTORY_SEPARATOR.'__gh716_ctime_probe.txt';
        $original = "the content this case will put back\n";

        file_put_contents($probe, $original);
        clearstatcache();
        $originalMtime = filemtime($probe);
        $before = TreeFingerprint::take();

        // A second, so the revert lands in a later ctime than the reading above.
        sleep(1);
        file_put_contents($probe, "changed inside the run\n");
        file_put_contents($probe, $original);
        // The revert a careful person makes: the content is back AND so is the modification time.
        touch($probe, $originalMtime);
        clearstatcache();
        $after = TreeFingerprint::take();

        $probeMd5 = md5_file($probe);
        $revertedMtime = filemtime($probe);
        @unlink($probe);

        $said = TreeFingerprint::verdict($before, $after);
        fwrite(STDOUT, '[gh716] probe '.$probe.' | md5 after the revert: '.$probeMd5
            .' | content hash '.$before['hash'].' -> '.$after['hash']
            .' | probe mtime '.$originalMtime.' -> '.$revertedMtime.' (PUT BACK by the revert)'
            .' | newest ctime '.$before['newestCtime'].' -> '.$after['newestCtime']
            .' (a revert CANNOT put this back)'
            .' | files '.$before['files'].' -> '.$after['files']
            .' | verdict: '.json_encode($said)."\n");

        // Positive controls first: the tree was really read, and the content really came back.
        $this->assertGreaterThan(100, $before['files'], 'the walk found no tree to read');
        $this->assertSame(md5($original), $probeMd5, 'the probe did not come back');
        $this->assertSame($before['hash'], $after['hash'], 'the content hash moved, so this is not the case');
        // And the mtime really is back, so what moves below can only be the ctime. Without this the
        // case passes on a reading of either, which is what the acceptor measured.
        $this->assertSame($originalMtime, $revertedMtime, 'the revert did not put the mtime back');
        // THE SUBJECT: the number `take()` reports is the NEWEST ctime of the tree it just walked.
        $this->assertGreaterThan($before['newestCtime'], $after['newestCtime']);
        $this->assertNotNull($said);
        $this->assertStringContainsString('content is back', $said);
    }

    public function test_a_run_that_moved_nothing_says_nothing(): void
    {
        $same = ['hash' => 'aaaaaaaaaaaaaaaa', 'newestCtime' => 1000, 'files' => 10, 'root' => '/x', 'excluded' => []];

        $this->assertNull(TreeFingerprint::verdict($same, $same));
    }

    public function test_the_fourth_boundary_a_file_that_appears_and_vanishes_is_not_seen(): void
    {
        /**
         * NOT A PROMISE, A MEASUREMENT. The reviewer's own boundary from the Jest half, measured
         * again here because it is the one that cost a suite: a file created and removed between
         * the two readings leaves no trace in either, so the run calls itself valid.
         *
         * The probe is declared by name and lives inside this one test.
         */
        $probe = __DIR__.'/../fixtures/gh716-probe-'.getmypid().'.txt';

        $before = TreeFingerprint::take();
        file_put_contents($probe, 'GH-716');
        $seen = TreeFingerprint::take();
        unlink($probe);
        $after = TreeFingerprint::take();

        fwrite(STDOUT, '[gh716] probe: '.$probe."\n"
            .'[gh716] files before '.$before['files'].', while present '.$seen['files']
            .', after '.$after['files']."\n"
            .'[gh716] verdict across the appearance and the removal: '
            .json_encode(TreeFingerprint::verdict($before, $after))."\n");

        // While it is there the universe grew, so the walk does see a new file.
        $this->assertSame($before['files'] + 1, $seen['files']);
        $this->assertNotSame($before['hash'], $seen['hash']);
        // And once it is gone, both readings agree: THIS is the boundary, named out loud.
        $this->assertSame($before['files'], $after['files']);
        $this->assertSame($before['hash'], $after['hash']);
        $this->assertNull(TreeFingerprint::verdict($before, $after));
    }
}

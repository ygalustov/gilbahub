<?php

namespace App\Support;

/**
 * GH-722 — WHAT A FILE OF SAMPLES CAME TO, AS A CLASS WITH NUMBERS, AND THE ONE PLACE ITS WORDS LIVE.
 *
 * The owner's decisions, 24.09.2026: a file in which no reading is recognised is a problem of the
 * upload, not of the calculation, and is not loaded; a file in which something is recognised loads
 * what was recognised; and the refusal says so in her words. Every path that loads samples from a
 * file answers with this — the Settings import now, the Data page upload next — so the two cannot
 * say the same thing two ways.
 *
 * THE CLASS DECIDES, NOT THE TEXT. `saved` means everything in the file was loaded; `partial` means
 * something was not, and it is never worded as a success; `rejected` means nothing was recognised
 * and nothing changed. A page shows the message it is given and styles it by the class; a test
 * checks the class and the numbers, never the sentence, so the owner can change the words without
 * breaking a test.
 *
 * WHOSE WORDS: the refusal's first three sentences are the owner's. The sentence with the numbers
 * after them, and the `saved` and `partial` sentences, are drafts awaiting her words; the numbers
 * inside them are not.
 */
class SampleUploadOutcome
{
    public const SAVED = 'saved';

    public const PARTIAL = 'partial';

    public const REJECTED = 'rejected';

    /** The owner's words for a file with nothing recognised in it. */
    public const REJECTED_TEXT = 'Invalid file format. The file was not uploaded. Please check the file format and try again.';

    /**
     * @param  int  $read  samples found in the file
     * @param  int  $saved  samples actually written
     * @param  array<int,array{type:string,label:string,reason:string}>  $notSaved
     * @return array{outcome:string,rowsRead:int,rowsSaved:int,notSaved:array<int,array{type:string,label:string,reason:string}>,message:string}
     */
    public static function of(int $read, int $saved, array $notSaved): array
    {
        $outcome = $saved === 0 ? self::REJECTED : ($saved < $read ? self::PARTIAL : self::SAVED);

        return [
            'outcome' => $outcome,
            'rowsRead' => $read,
            'rowsSaved' => $saved,
            'notSaved' => array_values($notSaved),
            'message' => self::message($outcome, $read, $saved, $notSaved),
        ];
    }

    /** @param array<int,array{type:string,label:string,reason:string}> $notSaved */
    private static function message(string $outcome, int $read, int $saved, array $notSaved): string
    {
        if ($outcome === self::REJECTED) {
            return self::REJECTED_TEXT.' '.($read === 0
                ? 'The file holds no samples.'
                : 'No readings were recognised in any of the '.$read.' '.self::samples($read).' in the file.');
        }
        $head = $saved.' of '.$read.' '.self::samples($read).' uploaded.';
        if ($outcome === self::SAVED) {
            return $head;
        }
        $labels = array_map(static fn ($n) => $n['label'] !== '' ? $n['label'] : '('.$n['type'].', no name)', $notSaved);

        return $head.' Not uploaded, no readings recognised: '.implode(', ', $labels).'.';
    }

    private static function samples(int $n): string
    {
        return $n === 1 ? 'sample' : 'samples';
    }
}

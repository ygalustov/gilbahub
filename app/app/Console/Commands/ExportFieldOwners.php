<?php

namespace App\Console\Commands;

use App\Support\FieldOwners;
use Illuminate\Console\Command;

/**
 * GH-474 — write the ownership table where the browser's tests can read it.
 *
 * One declaration, two readers. The server routes writes by `FieldOwners`;
 * the resolver builds its read paths from the same table, and a test compares
 * the two enumerations in both directions — a field the server knows and the
 * resolver does not, or the other way round, fails.
 *
 * The fixture is generated rather than typed so that the copy cannot drift
 * from the declaration: that is the whole shape this refinement removes.
 */
class ExportFieldOwners extends Command
{
    protected $signature = 'sites:export-field-owners {--path= : write to this file instead of standard output}';

    protected $description = 'Write the field-ownership table to tests/fixtures/field-owners.json';

    public function handle(): int
    {
        $payload = [
            '_why' => 'Who owns each fact about a site: a column on `sites`, or the config when no column '
                .'exists for it. Generated from App\\Support\\FieldOwners by `php artisan sites:export-field-owners` '
                .'so that the browser side cannot drift from the server\'s declaration.',
            '_generated' => now()->toDateString(),
            'owners' => FieldOwners::OWNERS,
            'derivedCopies' => FieldOwners::derivedCopies(),
        ];

        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n";
        $path = $this->option('path');

        if ($path === null || $path === '-') {
            // Standard output by default: the tests folder is not mounted into
            // the app container, so the host redirects this into the fixture.
            $this->output->write($json);

            return self::SUCCESS;
        }

        file_put_contents($path, $json);
        $this->info('Wrote '.count(FieldOwners::OWNERS).' fields to '.$path);

        return self::SUCCESS;
    }
}

<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\RunStart;
use App\Support\ZoneTypes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-816 (queue item "Zones", ZhT) — WHICH APPLICATIONS OF THE SPRAY JOURNAL THE ANALYSIS COUNTS.
 *
 * The owner's decision, variant (b): on a sports site and a lawn an application to a zone of any type
 * counts; on a golf course only an application to a green does. The rule is declared once
 * (`analysisZoneTypes` in assets/zone-types.json) and read once (`ZoneTypes::analysisZoneTypesFor`), and it
 * has two readers that must answer alike: the spray-log context the calculation asks (`lastPGR`), and
 * the run start's "the PGR is filled in". Every case asserts both.
 *
 * The context is asked the way the calculation asks it today, with `zone=greens`: the server no longer
 * reads that parameter, and a case that did not send it could not tell a server that ignores it from one
 * that still filters by it.
 *
 * Every row is written with a WORD of the journal and carries the type the dictionary gives that word
 * (`ZoneTypes::zoneTypeOfJournalWord`, the answer the journal's writers store); no zone type is a literal
 * of this file. The two words the dictionary leaves without a type (`noType`) are cases of their own:
 * counted on a sports site, not on a golf course.
 *
 * The rows of the case are printed as a list -- what was examined, the site's turf type, what counted
 * and what did not -- so "no PGR counted" is told apart from "no row got that far".
 */
class Gh816WhichApplicationsTheAnalysisCountsTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<int,array{site: string, turfType: string, id: int, type: string}> */
    private array $examined = [];

    public function test_the_analysis_counts_by_the_sites_turf_type_and_both_readers_agree(): void
    {
        // The words, from the dictionary: the one meaning a green, those meaning another type, and those with none.
        $words = ZoneTypes::journalWords();
        $greenWord = array_search('green', $words, true);
        $typedNotGreen = array_keys(array_filter($words, fn ($t) => $t !== null && $t !== 'green' && $t !== 'other'));
        $noTypeWords = array_keys(array_filter($words, fn ($t) => $t === null));
        fwrite(STDOUT, '[gh816] words used: green '.json_encode($greenWord).', typed not green '
            .json_encode($typedNotGreen).', no type '.json_encode($noTypeWords).PHP_EOL);
        $this->assertNotFalse($greenWord);
        $this->assertGreaterThanOrEqual(2, count($typedNotGreen));
        $this->assertSame(['surrounds', 'sportsground'], $noTypeWords);

        [$user, $sports] = $this->aSite('sports', 'GH-816 sports');
        // The shape of the live record 16 (a sports site's PGR written `other`), and a later one on another
        // type: "any type" is shown on two types, and the last one is the one named.
        $other = $this->aPgr($user, $sports, 'other', 20);
        $later = $this->aPgr($user, $sports, $typedNotGreen[0], 10);

        [, $golfNotGreen] = $this->aSite('golf', 'GH-816 golf not green', $user);
        $this->aPgr($user, $golfNotGreen, $typedNotGreen[1], 10);

        [, $golfGreen] = $this->aSite('golf', 'GH-816 golf green', $user);
        $green = $this->aPgr($user, $golfGreen, $greenWord, 10);

        [, $sportsNoType] = $this->aSite('sports', 'GH-816 sports, word with no type', $user);
        $sportsground = $this->aPgr($user, $sportsNoType, 'sportsground', 10);

        [, $golfNoType] = $this->aSite('golf', 'GH-816 golf, word with no type', $user);
        $this->aPgr($user, $golfNoType, 'surrounds', 10);

        [, $lawn] = $this->aSite('lawns', 'GH-816 lawn', $user);
        $lawnRow = $this->aPgr($user, $lawn, $typedNotGreen[0], 10);

        $answers = [];
        foreach (['case 1 sports' => $sports, 'case 2 golf, not green' => $golfNotGreen,
            'case 3 golf, green' => $golfGreen, 'case 4 sports, sportsground (no type)' => $sportsNoType,
            'case 5 golf, surrounds (no type)' => $golfNoType, 'print: lawn' => $lawn] as $name => $site) {
            $context = $this->actingAs($user)
                ->getJson('/api/spray-log/context?site_id='.$site->id.'&zone=greens')->assertOk()->json();
            $answers[$name] = [
                'lastPGR' => $context['lastPGR']['log_id'] ?? null,
                'runStartPgrFilledIn' => RunStart::had(RunStart::observe($site->fresh()), 'pgr.applicationDate'),
            ];
        }

        $counted = [];
        $notCounted = [];
        foreach ($this->examined as $row) {
            $named = in_array($row['id'], array_column($answers, 'lastPGR'), true);
            ($named ? $counted[] = $row : $notCounted[] = $row);
        }
        $turfTypes = array_count_values(array_column($this->examined, 'turfType'));
        fwrite(STDOUT, '[gh816] spray rows examined: '.count($this->examined).' (ids '
            .implode(', ', array_column($this->examined, 'id')).')'.PHP_EOL
            .'[gh816] site turf type of the rows: '.json_encode($turfTypes).PHP_EOL
            .'[gh816] named as the last PGR: '.json_encode(array_map(fn ($r) => $r['id'].' ('.$r['type'].', '.$r['turfType'].')', $counted)).PHP_EOL
            .'[gh816] not named: '.json_encode(array_map(fn ($r) => $r['id'].' ('.$r['type'].', '.$r['turfType'].')', $notCounted)).PHP_EOL
            .'[gh816] answers: '.json_encode($answers).PHP_EOL);

        // precondition: every row the cases need is there
        $this->assertSame(7, count($this->examined));
        $this->assertSame([
            'case 1 sports' => ['lastPGR' => $later, 'runStartPgrFilledIn' => true],
            'case 2 golf, not green' => ['lastPGR' => null, 'runStartPgrFilledIn' => false],
            'case 3 golf, green' => ['lastPGR' => $green, 'runStartPgrFilledIn' => true],
            'case 4 sports, sportsground (no type)' => ['lastPGR' => $sportsground, 'runStartPgrFilledIn' => true],
            'case 5 golf, surrounds (no type)' => ['lastPGR' => null, 'runStartPgrFilledIn' => false],
            'print: lawn' => ['lastPGR' => $lawnRow, 'runStartPgrFilledIn' => true],
        ], $answers);
        // and the earlier `other` row of the sports site counts too: asked on its own, it is the last PGR
        DB::table('spray_logs')->where('id', $later)->delete();
        $this->assertSame($other, $this->actingAs($user)
            ->getJson('/api/spray-log/context?site_id='.$sports->id.'&zone=greens')->json('lastPGR.log_id'));
    }

    public function test_a_site_with_no_turf_type_is_refused_with_the_inputs_name_not_answered_empty(): void
    {
        [$user, $site] = $this->aSite('sports', 'GH-816 no turf type');
        $this->aPgr($user, $site, 'greens', 5);
        $row = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->firstOrFail();
        $config = $row->config;
        unset($config['turf']['turfType']);
        $row->forceFill(['config' => $config])->save();

        $answer = $this->actingAs($user)->getJson('/api/spray-log/context?site_id='.$site->id.'&zone=greens');
        $runStart = RunStart::had(RunStart::observe($site->fresh()), 'pgr.applicationDate');
        fwrite(STDOUT, '[gh816] no turf type: '.$answer->status().' '.json_encode($answer->json())
            .'; run start: '.json_encode($runStart).PHP_EOL);

        $answer->assertStatus(422);
        $this->assertSame(['input' => 'turf.turfType', 'label' => 'the turf type'], $answer->json('missing'));
        $this->assertSame(RunStart::UNKNOWN, $runStart);
    }

    /** @return array{0: User, 1: Site} */
    private function aSite(string $turfType, string $name, ?User $user = null): array
    {
        $user = $user ?? User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => $name, 'slug' => 'gh816-'.bin2hex(random_bytes(4)),
            'site_type' => $turfType, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => 'manager']);
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
            'config' => ['turf' => ['methodology' => 'mlsn', 'turfType' => $turfType]],
        ]);
        $this->giveTheSiteWhatTheLockNeeds($site);

        return [$user, $site];
    }

    /** A PGR written with a word of the journal, carrying the type the dictionary gives that word. */
    private function aPgr(User $user, Site $site, string $word, int $daysAgo): int
    {
        $zoneType = ZoneTypes::zoneTypeOfJournalWord($word);
        $id = DB::table('spray_logs')->insertGetId([
            'account_id' => $site->account_id, 'site_id' => $site->id, 'user_id' => $user->id,
            'event_date' => now()->subDays($daysAgo)->toDateString(),
            'zone' => $word, 'zone_type' => $zoneType, 'product_name' => 'Primo Maxx', 'product_type' => 'pgr',
            'active_ingredient' => 'Trinexapac-ethyl', 'rate_value' => 0.5, 'rate_unit' => 'L/ha',
            'source' => 'manual', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $config = SiteConfig::query()->where('site_id', $site->id)->where('namespace', 'gaip')->first()->config;
        $this->examined[] = ['site' => $site->name, 'turfType' => (string) ($config['turf']['turfType'] ?? 'not set'),
            'id' => (int) $id, 'type' => $zoneType ?? 'no type'];

        return (int) $id;
    }
}

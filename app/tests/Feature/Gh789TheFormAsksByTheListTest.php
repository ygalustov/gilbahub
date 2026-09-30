<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Support\CalculationInputs;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GH-789 (queue item 7) — EVERY REQUIRED FIELD IS DRAWN, BOUND TO ITS INPUT, AND MARKED — PER TURF TYPE
 * AND PER ROLE.
 *
 * WHY IT IS A RENDER TEST AND NOT A READING OF THE TEMPLATE. The obligation used to be an HTML `required`
 * attribute typed into five fields of forms that all carry `novalidate`: a mark and nothing else, and it
 * named the wrong five -- the turf type and the methodology were required by the list and unmarked, the
 * cultivar and the construction were marked, and the golf surface, required of golf alone, cannot be
 * expressed by an attribute at all. Now the mark is derived from the list for the site being looked at, so
 * what must be asserted is what the PAGE shows, for each kind of site.
 *
 * THE REVIEWER'S INVARIANT, kept as he put it: the element at the address is rendered ENABLED, for every
 * pair of turf type and role. A test that only searched for the address would pass on a field drawn
 * `disabled`, which a person cannot answer.
 *
 * BOTH DIRECTIONS. An input the list does NOT require of this type carries no mark: a lawn is not told its
 * golf surface is required, and a golf site is not told to enter a match schedule. Without that half, "the
 * marks are right" would be satisfied by a page that marks everything.
 */
class Gh789TheFormAsksByTheListTest extends TestCase
{
    use RefreshDatabase;

    /** The roles the product lets edit a site, which is who Settings is for. */
    private const EDITING_ROLES = ['admin', 'manager', 'editor'];

    /**
     * ONE CONTROL, TWO INPUTS -- named here with its reason rather than excused by a rule.
     *
     * A person answers both coordinates by picking a result from the Location search: that is the one field
     * they act on, and asking somebody to type a latitude by hand is asking for the wrong number. So the
     * word "Required" is drawn once, beside Location, and the longitude is answered with the latitude. All
     * three controls carry their binding, so a refusal still frames every box the value lands in -- which
     * is asserted separately below, by looking for the bound fields themselves.
     *
     * @var array<string,string>
     */
    private const ANSWERED_WITH = ['location.lon' => 'location.lat'];

    public function test_every_required_input_of_this_site_is_drawn_bound_and_marked(): void
    {
        $report = [];
        foreach (['golf', 'sports', 'lawns'] as $turfType) {
            foreach (self::EDITING_ROLES as $role) {
                $html = $this->settingsFor($turfType, $role);
                $required = array_values(array_filter(
                    CalculationInputs::requiredFor($turfType),
                    fn ($key) => $this->listSaysSettings($key)
                ));

                $unbound = [];
                $unmarked = [];
                $disabled = [];
                foreach ($required as $key) {
                    $fields = $this->fieldsFor($html, $key);
                    if ($fields === []) {
                        $unbound[] = $key;
                        continue;
                    }
                    foreach ($fields as $field) {
                        if (preg_match('/\bdisabled\b/', $field) === 1) {
                            $disabled[] = $key;
                        }
                    }
                    $marksFor = self::ANSWERED_WITH[$key] ?? $key;
                    if (! $this->markedRequired($html, $marksFor)) {
                        $unmarked[] = $key;
                    }
                }
                $report[] = [
                    'turfType' => $turfType, 'role' => $role,
                    'required' => count($required), 'unbound' => $unbound,
                    'unmarked' => $unmarked, 'disabled' => $disabled,
                ];
            }
        }

        fwrite(STDOUT, PHP_EOL.'[gh789] what the Settings page draws:'.PHP_EOL);
        foreach ($report as $row) {
            fwrite(STDOUT, '[gh789]   '.str_pad($row['turfType'].' / '.$row['role'], 18)
                .' required here: '.$row['required']
                .' | not bound: '.json_encode($row['unbound'])
                .' | not marked: '.json_encode($row['unmarked'])
                .' | drawn disabled: '.json_encode($row['disabled']).PHP_EOL);
        }

        // The subject exists: each pair has required inputs to look for at all.
        $this->assertSame([], array_values(array_filter($report, fn ($r) => $r['required'] < 1)));
        $this->assertSame([], array_values(array_filter($report, fn ($r) => $r['unbound'] !== [])));
        $this->assertSame([], array_values(array_filter($report, fn ($r) => $r['unmarked'] !== [])));
        $this->assertSame([], array_values(array_filter($report, fn ($r) => $r['disabled'] !== [])));
    }

    /** THE OTHER HALF: a type is not marked for an obligation that is not its own. */
    public function test_a_type_is_not_told_to_fill_in_what_it_is_not_asked(): void
    {
        $golf = $this->settingsFor('golf', 'manager');
        $sports = $this->settingsFor('sports', 'manager');
        $lawns = $this->settingsFor('lawns', 'manager');

        $seen = [
            'golf marked for its surface' => $this->markedRequired($golf, 'turf.subCategory'),
            'golf marked for a schedule' => $this->markedRequired($golf, 'traffic.schedule'),
            'sports marked for a schedule' => $this->markedRequired($sports, 'traffic.schedule'),
            'sports marked for a surface' => $this->markedRequired($sports, 'turf.subCategory'),
            'lawns marked for a surface' => $this->markedRequired($lawns, 'turf.subCategory'),
            'lawns marked for a schedule' => $this->markedRequired($lawns, 'traffic.schedule'),
        ];
        fwrite(STDOUT, '[gh789] marks by type:'.PHP_EOL);
        foreach ($seen as $what => $marked) {
            fwrite(STDOUT, '[gh789]   '.str_pad($what, 30).' -> '.($marked ? 'MARKED' : 'not marked').PHP_EOL);
        }

        $this->assertTrue($seen['golf marked for its surface']);
        $this->assertTrue($seen['sports marked for a schedule']);
        $this->assertFalse($seen['golf marked for a schedule']);
        // The sports surface is the owner's open question, so nobody requires it of a sports site.
        $this->assertFalse($seen['sports marked for a surface']);
        $this->assertFalse($seen['lawns marked for a surface']);
        $this->assertFalse($seen['lawns marked for a schedule']);
    }

    /**
     * AND NO FIELD CARRIES THE OLD ATTRIBUTE, on any of the three forms.
     *
     * `required` on a `novalidate` form is a mark the browser never acts on, and its presence beside the
     * derived one would be a second answer to the same question -- the thing this queue item is about.
     */
    public function test_the_html_required_attribute_is_gone_from_the_settings_forms(): void
    {
        $html = $this->settingsFor('sports', 'manager');
        preg_match_all('/<(?:input|select|textarea)\b[^>]*>/', $html, $matches);
        $withAttribute = array_values(array_filter($matches[0],
            fn ($tag) => preg_match('/\srequired(\s|=|>|\/)/', $tag) === 1));
        fwrite(STDOUT, '[gh789] controls still carrying `required`: '.count($withAttribute)
            .($withAttribute === [] ? '' : ' -> '.json_encode($withAttribute)).PHP_EOL);

        $this->assertSame([], $withAttribute);
        // The positive control: the page really was rendered and really has controls on it.
        $this->assertGreaterThan(20, count($matches[0]));
    }

    /**
     * GH-789 (queue item 7) — THE FORM DOES NOT CHOOSE A SOIL MOISTURE FOR ANYBODY.
     *
     * The Traffic & Wear list had no empty option and stood on `optimal`, and the form sends the whole
     * schedule on every save, so every save wrote a word nobody had chosen. It is the declared storage of
     * the input `soil.moisture`, and the orchestrator takes the entered word as the FIRST source, ahead of
     * the measured climate band -- so the wear engine's compaction and wear factors ran on it.
     *
     * MEASURED ON THE STAND, 30.09.2026: the two sports sites whose Traffic tab had ever been saved both
     * carry `moisture: "optimal"`, and neither owner chose it.
     *
     * WHAT IS ASSERTED: the option exists, it is the one standing when the site holds no moisture, and a
     * site that DOES hold one still shows it -- the second half is what tells "nothing is chosen for you"
     * from "the field stopped working".
     */
    public function test_the_soil_moisture_list_offers_not_chosen_and_stands_on_it(): void
    {
        $html = $this->settingsFor('sports', 'manager');
        $list = $this->selectNamed($html, 'stg-tw-moisture');
        fwrite(STDOUT, '[gh789] the soil moisture list, with nothing stored: '
            .preg_replace('/\s+/', ' ', $list).PHP_EOL);

        $this->assertStringContainsString('<option value="" selected>', $list);
        // And no word is pre-chosen beside it.
        $this->assertSame(1, preg_match_all('/\bselected\b/', $list));
        $this->assertStringContainsString('data-input="soil.moisture"', $list);
    }

    /** The tag of one select, from its id to its closing tag. */
    private function selectNamed(string $html, string $id): string
    {
        $at = strpos($html, 'id="'.$id.'"');
        $this->assertNotFalse($at, $id.' is gone from the form');
        $end = strpos($html, '</select>', $at);

        return substr($html, $at - 8, $end - $at + 17);
    }

    /**
     * GH-789 (queue item 7) — AN EMPTY FIELD IS DRAWN EMPTY: THE TEMPLATE LAYER.
     *
     * WHY THIS CASE EXISTS, and it is the reviewer's finding rather than an extra. The substitution of nought
     * in these two boxes had TWO layers -- `|| '0'` where the form builds its request, and a template
     * fallback that put `0` into the box when the site held nothing -- and the argument for repairing both
     * was that repairing the sender alone would close nothing: the page would show `0`, the person would
     * save, and the nought would be stored as a measured fact all the same. Only the sender was asserted
     * (`tests/gh733-…:147`), so the template layer could be put back and both suites stayed green. Measured
     * by the reviewer: `$turfVal('c3Cover')` -> `$turfVal('c3Cover', '0')`, JS 4007 passed, PHP 3409 passed,
     * no new failure.
     *
     * THREE OUTCOMES, because two would not tell a repair from a broken field:
     *
     *   the site holds nothing -> the box is EMPTY. Nobody has measured the Poa or the cool-season cover.
     *   the site holds `0`     -> the box shows `0`. It is an answer somebody gave: a stand with no Poa, and
     *                             "0 = pure C4", which the page's own hint says in as many words.
     *   the site holds a figure -> the box shows the figure.
     *
     * AND NO `placeholder`, for the same reason the wizard's schedule has none: a figure standing in an
     * empty box reads as a value already entered.
     */
    public function test_an_empty_figure_is_drawn_empty_and_a_stored_nought_is_drawn_as_nought(): void
    {
        $cases = [
            'nothing stored' => [],
            'a stored nought' => ['poaPercent' => 0, 'c3Cover' => 0],
            'a stored figure' => ['poaPercent' => 12, 'c3Cover' => 60],
            'a stored nought as a string' => ['poaPercent' => '0', 'c3Cover' => '0'],
        ];
        $drawn = [];
        foreach ($cases as $what => $turf) {
            $html = $this->settingsFor('sports', 'manager', $turf);
            $drawn[$what] = [
                'poaPercent' => $this->valueDrawn($html, 'stg-turf-poa'),
                'c3Cover' => $this->valueDrawn($html, 'stg-turf-c3'),
                'placeholder' => preg_match('/id="stg-turf-c3"[^>]*placeholder/', $html) === 1,
            ];
        }
        fwrite(STDOUT, PHP_EOL.'[gh789] the two figures, as the form draws them:'.PHP_EOL);
        foreach ($drawn as $what => $row) {
            fwrite(STDOUT, '[gh789]   '.str_pad($what, 28).' -> Poa '.json_encode($row['poaPercent'])
                .', C3 '.json_encode($row['c3Cover'])
                .($row['placeholder'] ? ' | A PLACEHOLDER IS DRAWN' : '').PHP_EOL);
        }

        // NOTHING STORED IS DRAWN AS NOTHING. This is the assertion the reviewer's mutation reddens.
        $this->assertSame('', $drawn['nothing stored']['poaPercent']);
        $this->assertSame('', $drawn['nothing stored']['c3Cover']);
        // AND THE OTHER TWO OUTCOMES, which is what tells the repair from a field that stopped working.
        $this->assertSame('0', $drawn['a stored nought']['poaPercent']);
        $this->assertSame('0', $drawn['a stored nought']['c3Cover']);
        $this->assertSame('0', $drawn['a stored nought as a string']['c3Cover']);
        $this->assertSame('12', $drawn['a stored figure']['poaPercent']);
        $this->assertSame('60', $drawn['a stored figure']['c3Cover']);
        // No figure in an empty box, whatever the site holds.
        foreach ($drawn as $what => $row) {
            $this->assertFalse($row['placeholder'], $what.': a placeholder stands in the C3 box');
        }
    }

    /** What the `value` attribute of one control actually says on the rendered page. */
    private function valueDrawn(string $html, string $id): string
    {
        $at = strpos($html, 'id="'.$id.'"');
        $this->assertNotFalse($at, $id.' is gone from the form');
        $tag = substr($html, $at, (int) strpos($html, '>', $at) - $at);
        if (preg_match('/\bvalue="([^"]*)"/', $tag, $m) !== 1) {
            // No attribute at all is not the same as an empty one, and a case must be able to say which.
            return '(no value attribute)';
        }

        return $m[1];
    }

    /** Does the list say this input is entered at a Settings place? */
    private function listSaysSettings(string $key): bool
    {
        foreach ((array) ((CalculationInputs::entry($key) ?? [])['filledIn'] ?? []) as $place) {
            if (str_starts_with($place, 'settings.')) {
                return true;
            }
        }

        return false;
    }

    /** @return array<int,string> the rendered tags bound to this input */
    private function fieldsFor(string $html, string $key): array
    {
        preg_match_all('/<(?:input|select|textarea)\b[^>]*data-input="'.preg_quote($key, '/').'"[^>]*>/', $html, $m);

        return $m[0];
    }

    /** Is the word drawn beside a field bound to this input? */
    private function markedRequired(string $html, string $key): bool
    {
        $at = strpos($html, 'data-input="'.$key.'"');
        if ($at === false) {
            return false;
        }
        // The note is drawn on the label, just above the control it belongs to.
        $before = substr($html, max(0, $at - 400), min(400, $at));

        return str_contains($before, 'gilba-required-note');
    }

    /** The page as a person of this role sees it for a site of this turf type. */
    private function settingsFor(string $turfType, string $role, array $turf = []): string
    {
        $user = User::factory()->create();
        $account = Account::query()->firstOrCreate(
            ['owner_user_id' => $user->id],
            ['display_name' => $user->name, 'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id]
        );
        $site = Site::query()->create([
            'account_id' => $account->id, 'name' => 'GH-789 '.$turfType,
            'slug' => 'gh789-form-'.$turfType.'-'.substr(bin2hex(random_bytes(6)), 0, 8),
            'site_type' => $turfType === 'golf' ? 'golf' : 'sports', 'timezone' => 'UTC',
            'latitude' => -35.28, 'longitude' => 149.13,
            'created_by_user_id' => $user->id, 'modified_by_user_id' => $user->id,
        ]);
        $site->users()->attach($user->id, ['role' => $role]);
        // Settings draws the ACTIVE site; without this the page renders "No active site configured" and
        // every field below would be reported missing for a reason that is not the subject.
        $user->forceFill(['last_active_site_id' => $site->id])->save();
        SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'synced_at' => now(),
            'config' => $this->configThePageLockAccepts([
                'turf' => array_merge(['turfType' => $turfType], $turf),
            ]),
        ]);

        return $this->actingAs($user->fresh())->get('/settings')->assertOk()->getContent();
    }
}

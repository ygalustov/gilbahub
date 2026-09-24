<?php

namespace Tests\Feature;

use App\Support\DependencyGraph;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

/**
 * GH-688 (queue item 6, the reviewer's first return) — THE SERVER'S READER OF THE GRAPH, AND THE
 * DIFFERENCE BETWEEN REFUSING AND ANSWERING EMPTY.
 *
 * Forty-one tests execute `DependencyGraph` on their way to something else, and not one of them
 * could tell those two apart: the path to the file was written into the method, so nothing could
 * hand the reader a graph that fails to load. The refusal is the whole reason the class exists
 * rather than a bare `json_decode` — an empty graph makes every "is this module declared" answer
 * "no" in silence — and it had no case of its own.
 *
 * WHAT IS ASSERTED IS THE OUTCOME, one case per way of failing, each with the real file restored
 * afterwards. And the positive control comes first: the reader ANSWERS on the tree as it stands, or
 * every refusal below would be a refusal about nothing.
 *
 * A FINDING FROM BUILDING IT, fixed in the same work: `{"nodes":{}}` was accepted. It is valid JSON
 * with a `nodes` key, so the check passed it, and the reader then answered every question with
 * "nobody" — the exact silence the class refuses elsewhere. It is refused now, and the case below
 * would have been green before the fix only because nothing asked.
 */
class Gh688DependencyGraphRefusesTest extends TestCase
{
    protected function tearDown(): void
    {
        // The real file, whatever happened. A leaked override would make every later test in the
        // process read a temporary graph.
        DependencyGraph::readFrom(null);
        parent::tearDown();
    }

    public function test_the_reader_answers_on_the_tree_as_it_stands(): void
    {
        DependencyGraph::readFrom(null);
        $nodes = DependencyGraph::nodes();
        fwrite(STDOUT, PHP_EOL.'[gh688] the tree answers with '.count($nodes).' nodes; four of them: '
            .json_encode(array_slice(array_keys($nodes), 0, 4)).PHP_EOL);

        // Named as well as counted: a reader that answered with a different 31 things would pass a
        // count and fail this.
        $this->assertGreaterThan(20, count($nodes));
        $this->assertArrayHasKey('mlsn-calculator', $nodes);
        // A key TAKEN FROM THE FILE rather than from memory: the first version of this line asked
        // for the writer of `soilNutrition` and got null, because no node declares it — that is a
        // known hole in the graph's data, not a broken reader, and asserting it here would have made
        // this case fail for somebody else's reason.
        $this->assertSame('climate-engine', DependencyGraph::writerOf('climate'));
        $this->assertSame('climate-engine', DependencyGraph::writerOf('computed.climate'),
            'the two spellings must reach the same node, which is what this reader is for');
    }

    /** @return iterable<string, array{0:string|null, 1:string}> */
    public static function waysOfFailing(): iterable
    {
        yield 'the file is not there' => [null, 'missing or does not declare nodes'];
        yield 'it is not JSON at all' => ['not json, just words', 'missing or does not declare nodes'];
        yield 'it is JSON but not an object' => ['[1, 2, 3]', 'missing or does not declare nodes'];
        yield 'it declares no `nodes` key' => ['{"version": 3}', 'missing or does not declare nodes'];
        yield '`nodes` is not a map' => ['{"nodes": "soon"}', 'missing or does not declare nodes'];
        yield '`nodes` is an EMPTY map' => ['{"nodes": {}}', 'declares no nodes at all'];
    }

    #[DataProvider('waysOfFailing')]
    public function test_a_graph_that_did_not_load_is_refused_and_says_which_file(?string $contents, string $expected): void
    {
        $path = $contents === null
            ? sys_get_temp_dir().'/gh688-there-is-no-such-file-'.uniqid().'.json'
            : tempnam(sys_get_temp_dir(), 'gh688').'.json';
        if ($contents !== null) {
            file_put_contents($path, $contents);
        }

        DependencyGraph::readFrom($path);

        try {
            $nodes = DependencyGraph::nodes();
            $this->fail('the reader ANSWERED with '.json_encode($nodes)
                .' instead of refusing — "empty" and "did not load" are the same answer again');
        } catch (RuntimeException $e) {
            fwrite(STDOUT, '[gh688] refused: '.$e->getMessage().PHP_EOL);
            $this->assertStringContainsString($expected, $e->getMessage());
            // It names the file it tried, so a refusal in a real run can be chased.
            $this->assertStringContainsString($path, $e->getMessage());
        } finally {
            if ($contents !== null && is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_the_refusal_is_not_cached_as_an_answer(): void
    {
        // A reader that remembered a failure, or remembered the wrong file, would answer the rest of
        // the request from it. The real graph must come back immediately after a refusal.
        DependencyGraph::readFrom(sys_get_temp_dir().'/gh688-nothing-here.json');
        try {
            DependencyGraph::all();
            $this->fail('no refusal');
        } catch (RuntimeException) {
            // expected
        }

        DependencyGraph::readFrom(null);
        $this->assertGreaterThan(20, count(DependencyGraph::nodes()));
    }

    public function test_the_page_is_handed_the_same_graph_with_nothing_added(): void
    {
        // `forClient` is the delivery path into the browser. If it started shaping the data, the
        // page and the server would hold two graphs.
        DependencyGraph::readFrom(null);
        $this->assertSame(DependencyGraph::all(), DependencyGraph::forClient());
    }

    public function test_nothing_in_the_product_uses_the_test_seam(): void
    {
        /**
         * The census that keeps `readFrom` a seam. A product caller would be a second source for the
         * graph, which is the thing this class exists to prevent — so the universe is the tree, not
         * a list written here.
         */
        $roots = [base_path('app'), base_path('resources'), base_path('routes'), base_path('config')];
        $callers = [];
        foreach ($roots as $root) {
            if (! is_dir($root)) {
                continue;
            }
            $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root));
            foreach ($files as $file) {
                if (! $file->isFile() || ! in_array($file->getExtension(), ['php'], true)) {
                    continue;
                }
                $body = (string) file_get_contents($file->getPathname());
                if (str_contains($body, 'readFrom(') && ! str_contains($file->getPathname(), '/Support/DependencyGraph.php')) {
                    $callers[] = str_replace(base_path(), '', $file->getPathname());
                }
            }
        }
        fwrite(STDOUT, '[gh688] product files calling the seam: '.json_encode($callers).PHP_EOL);

        $this->assertSame([], $callers, 'the test seam has a product caller, so the graph has a second source');
    }
}

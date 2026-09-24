<?php

namespace App\Support;

/**
 * GH-676 (queue item 6, remainder of stage 0b; the analyst's 59.2 and 59.5) — WHO
 * READS WHICH INPUT, AND WHAT HAPPENS WITHOUT IT, READ FROM ONE FILE.
 *
 * THE TWO FILES DO NOT OVERLAP, and that is the whole arrangement:
 *   - `calculation-inputs.schema.json` says what an INPUT is — its name, where it
 *     is filled in, whether a person must be asked for it;
 *   - `dependency-graph.json` says who READS it, what happens without it, which
 *     modules exist and who waits for whom.
 * Neither repeats the other. The inputs list carries no "what breaks without it"
 * (GH-642) and the graph carries no properties of an input; the two are joined in
 * one place, on the server, from these two readers. A `label` for an input
 * appearing in the graph, or an `affects` appearing in the list, is a copy — and
 * the equality test finds it.
 *
 * `requires` AGAINST `uses` IS THE POINT OF THE FILE:
 *   - `requires` — without this input the module does not compute at all, and its
 *     absence becomes `notApplicable` naming the missing input (item 4);
 *   - `uses` — without it the module computes DIFFERENTLY, and its absence is an
 *     assumption rather than a refusal.
 * That distinction is a judgement about what the code does, so it is filled by
 * hand from the list the test prints, never inferred.
 *
 * AND `requires` IS NOT `required`. The graph answers whether a module can be
 * COMPUTED without an input; the inputs list answers whether a person must be
 * ASKED for it. Root depth may be asked of everyone and is required only by wear
 * on a sports field.
 */
class DependencyGraph
{
    /** @var array<string,mixed>|null */
    private static ?array $cache = null;

    /** @var string|null set only by a test, through `readFrom`. */
    private static ?string $file = null;

    /**
     * GH-688 — A SEAM FOR THE REFUSAL, and only for it.
     *
     * The refusal below is the whole reason this class exists rather than a bare `json_decode`, and
     * until now nothing could reach it: the path was written into the method, so no test could hand
     * it a graph that fails to load. Forty-one tests execute this reader and not one of them could
     * tell "it refused" from "it answered empty".
     *
     * NOTHING IN THE PRODUCT CALLS THIS, and a census in `Gh688DependencyGraphRefusesTest` holds
     * that: a caller outside `tests` reddens it. A seam that the product starts using is a second
     * source for the graph, which is the thing this class is for.
     */
    public static function readFrom(?string $file): void
    {
        self::$file = $file;
        self::$cache = null;
    }

    /** @return array<string,mixed> */
    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $file = self::$file ?? base_path('../assets/dependency-graph.json');
        $decoded = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;

        // A graph that did not load is an outcome, not an empty graph: an empty one
        // would make every "is this module declared" question answer "no" in silence,
        // which is the shape the schema reader refuses for the same reason.
        if (! is_array($decoded) || ! isset($decoded['nodes']) || ! is_array($decoded['nodes'])) {
            throw new \RuntimeException('dependency-graph.json is missing or does not declare nodes: '.$file);
        }

        // GH-688 — AND A GRAPH WITH NO NODES IS THE SAME SILENCE, which the check above let through.
        // `{"nodes":{}}` is valid JSON with a `nodes` key, so it was accepted; every "is this module
        // declared" then answered "no" and every "who writes this" answered "nobody", which is
        // exactly the outcome the paragraph above says must not be reachable quietly. Found while
        // building the first test that could reach either path.
        if ($decoded['nodes'] === []) {
            throw new \RuntimeException('dependency-graph.json declares no nodes at all: '.$file);
        }

        return self::$cache = $decoded;
    }

    /** @return array<string,array<string,mixed>> */
    public static function nodes(): array
    {
        return self::all()['nodes'];
    }

    /** @return array<string,mixed>|null */
    public static function node(string $id): ?array
    {
        $node = self::nodes()[$id] ?? null;

        return is_array($node) ? $node : null;
    }

    /**
     * The node that writes this `computed` key, or null when nobody declares it.
     *
     * The key may be given bare (`soilNutrition`) or as the graph writes it
     * (`computed.soilNutrition`), because the two spellings are both in the tree and
     * a reader that accepted only one would answer "nobody" about a declared module.
     */
    public static function writerOf(string $key): ?string
    {
        $wanted = str_starts_with($key, 'computed.') ? $key : 'computed.'.$key;
        foreach (self::nodes() as $id => $node) {
            foreach (($node['outputs'] ?? []) as $out) {
                if ($out === $wanted || $out === $key) {
                    return $id;
                }
            }
        }

        return null;
    }

    /**
     * Every input this node reads, by kind.
     *
     * @return array{requires:array<int,string>,uses:array<int,string>}
     */
    public static function inputsOf(string $id): array
    {
        $node = self::node($id);

        return [
            'requires' => array_values((array) ($node['requires'] ?? [])),
            'uses' => array_values((array) ($node['uses'] ?? [])),
        ];
    }

    /** Every node that declares this input, in either kind. @return array<int,string> */
    public static function readersOf(string $input): array
    {
        $out = [];
        foreach (self::nodes() as $id => $node) {
            $declared = array_merge((array) ($node['requires'] ?? []), (array) ($node['uses'] ?? []));
            if (in_array($input, $declared, true)) {
                $out[] = $id;
            }
        }

        return $out;
    }

    /**
     * What the page is given: the graph as data, with nothing added.
     *
     * The browser copy of the graph keeps its FUNCTIONS and takes its DATA from
     * here, so there is one place where a module's inputs are declared rather than
     * two that drift.
     *
     * @return array<string,mixed>
     */
    public static function forClient(): array
    {
        return self::all();
    }
}

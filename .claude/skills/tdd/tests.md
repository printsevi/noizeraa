# Good and Bad Tests

## Good Tests

**Integration-style**: test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: tests observable behavior through the panels module's public seam
test("closing a panel with fewer than 5 producer responses suppresses that segment", async () => {
  const panel = await createPanelWithResponses({ producer: 4, fan: 12 });
  const results = await closePanel(panel.id);
  expect(results.segments.producer).toEqual({ suppressed: true, n: 4 });
});
```

Characteristics:

- Tests behavior callers care about (an artist reading results, a listener submitting a response)
- Uses the module's public API only (application service, HTTP handler, repository interface) — never a Drizzle table row shape or a Nest provider's private method
- Survives internal refactors (swapping the aggregation query, renaming a repository method)
- Describes WHAT, not HOW
- One logical assertion per test

## Bad Tests

**Implementation-detail tests**: coupled to internal structure.

```typescript
// BAD: tests implementation details
test("closePanel calls resultsAggregator.run", async () => {
  const mockAggregator = jest.mock(resultsAggregator);
  await closePanel(panel.id);
  expect(mockAggregator.run).toHaveBeenCalledWith(panel.id);
});
```

Red flags:

- Mocking internal collaborators (a repository your own module owns, a domain service)
- Testing private methods
- Asserting on call counts/order instead of outcome
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through a side channel instead of the interface

```typescript
// BAD: bypasses the interface to verify
test("uploading a version writes an asset row", async () => {
  await completeUpload(uploadId);
  const row = await db.query("SELECT * FROM assets WHERE id = $1", [assetId]);
  expect(row).toBeDefined();
});

// GOOD: verifies through the interface
test("completing an upload makes the version's asset retrievable", async () => {
  await completeUpload(uploadId);
  const version = await getVersion(versionId);
  expect(version.asset.bytes).toBeGreaterThan(0);
});
```

**Tautological tests**: the expected value restates the implementation, so the test passes by construction.

```typescript
// BAD: expected value is recomputed the way the code computes it
test("aggregatePreference sums comparison choices", () => {
  const comparisons = [{ chosen: "A" }, { chosen: "A" }, { chosen: "B" }];
  const expected = comparisons.filter((c) => c.chosen === "A").length;
  expect(aggregatePreference(comparisons).countA).toBe(expected);
});

// GOOD: expected value is an independent, known literal
test("aggregatePreference sums comparison choices", () => {
  const comparisons = [{ chosen: "A" }, { chosen: "A" }, { chosen: "B" }];
  expect(aggregatePreference(comparisons)).toEqual({ countA: 2, countB: 1 });
});
```

**Fabricated invariant tests**: asserting a domain rule the code doesn't actually claim to enforce yet, just to have coverage. If the panel results seam doesn't suppress n<5 segments yet, that test is the red step of a real cycle — not a test written to pad the suite while the rule stays unimplemented "for later."

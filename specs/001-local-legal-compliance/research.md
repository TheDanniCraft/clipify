# Research: Local Legal and Privacy Center

## Decision 1: Use one EU/German baseline for one document set

**Decision**: Publish one English legal-document set for all Clipify visitors. Because the operator is established in Germany, use EU/German data-protection and terminal-access requirements as the governing product baseline. Do not create regional policy variants in this feature and do not describe the result as guaranteed compliance with every law worldwide.

**Rationale**: A single clear policy set matches Clipify's current size, establishment, and the output users previously received from GoAdopt. The EU baseline is strict and directly relevant to the German operator. Other laws may become relevant through establishment, targeting, thresholds, or changed processing, but speculative regional documents would add maintenance without improving the present disclosure.

**Alternatives considered**:

- Separate UK, US, Brazilian, and Canadian documents: rejected for the first release because Clipify has no identified operational trigger requiring separate variants.
- A generic policy that claims worldwide compliance: rejected because strict EU alignment does not prove compliance with every regional rule.
- Geo-specific runtime policies: rejected because geolocation adds complexity and can create inaccurate outcomes.

**Primary references**:

- [EU GDPR, including transparency and consent requirements](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679)
- [EDPB Guidelines 05/2020 on consent](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf)
- [German TDDDG §25](https://www.gesetze-im-internet.de/ttdsg/__25.html)

Other jurisdictions are revisited only when Clipify establishes or targets operations there, crosses an applicability threshold, introduces relevant processing such as sale/sharing or behavioral advertising, or receives qualified advice identifying a concrete obligation.

## Decision 2: Independently author public documents

**Decision**: Use the current GoAdopt documents only as a private factual migration checklist. Independently structure and write the public policies from verified Clipify behavior, operator-confirmed business facts, and official requirements. Do not publish a substantially identical text.

**Rationale**: The earlier download/export behavior does not establish a continuing license to republish adapted provider text. Independent authorship also produces documents aligned with the actual consent engine and product rather than a generic template.

**Alternatives considered**:

- Copy and lightly edit GoAdopt output: rejected because copyright/license permission is unclear and technical drift would remain.
- Purchase WebsitePolicies immediately: deferred because recurring cost is disproportionate to current revenue; it remains an optional later comparison or review source.
- AI-only generic policies: rejected because they can invent business facts and do not replace factual or qualified legal review.

## Decision 3: Separate reviewed prose from generated technical disclosure

**Decision**: Keep legal explanations, legal bases, rights, contract terms, and jurisdiction notes as versioned reviewed content. Generate service and storage tables from a typed compliance registry used by the consent runtime.

**Rationale**: Legal prose should not silently change when code changes, while technical inventories should not be copied into multiple places. A single reviewed registry removes drift without turning the whole policy into unreviewed runtime output.

**Alternatives considered**:

- Entirely static policy tables: rejected because service and storage changes can drift from consent behavior.
- Entirely runtime-generated policies: rejected because legal interpretation and material-change review require editorial control.
- Browser scan as the authoritative policy: rejected because a scan sees only exercised flows and cannot expose every HTTP-only or conditional item.

## Decision 4: Use structured TypeScript content in the existing application

**Decision**: Store document metadata and structured content in the existing TypeScript application and render local App Router pages with a shared legal-document layout. Reuse the current c15t consent mechanism; no new service or container is introduced.

**Rationale**: This avoids an additional content system, database, deployment, or Markdown build pipeline. Structured content can be validated at build/test time and can embed dynamic registry components at deliberate positions.

**Alternatives considered**:

- Separate legal CMS: rejected for cost and operational complexity.
- Database-authored policies: rejected because version control and code review are stronger for the current team size.
- Raw Markdown files: viable, but deferred because bundling and validation would require an additional content-loading path while React/TypeScript content is already native to the application.

## Decision 5: Keep current-device inspection supplemental and private

**Decision**: The cookie policy may show a client-only “active on this device” view containing storage names and types, never values. The complete declared inventory remains authoritative.

**Rationale**: Browser JavaScript cannot see HTTP-only cookies and only observes current state. Showing names can help users diagnose consent without transmitting potentially sensitive values.

**Alternatives considered**:

- Send device storage to the server: rejected as unnecessary data collection.
- Present detected storage as complete: rejected as misleading.
- Omit device inspection: acceptable fallback, but the supplemental view improves transparency when clearly scoped.

## Decision 6: Audit representative flows in a real browser

**Decision**: Add Playwright-based read-only documentation checks with executable Gherkin bindings. Cover the local legal routes, existing preference-dialog entry point, representative public/authenticated flows, and enough preconfigured service states to observe declared cookies, web storage, scripts, and relevant external origins. Do not change or retest c15t's internal state machine as part of this feature.

**Rationale**: Unit tests prove document and registry rules but cannot prove that the resulting disclosures match observable product behavior. A real browser can inspect names and origins without making the legal-documents feature responsible for consent persistence or service lifecycle behavior.

**Alternatives considered**:

- Continue relying on external tag scanning: rejected because it missed conditional integrations and cannot validate Clipify's own disclosures.
- Unit tests only: rejected because they cannot detect undeclared runtime network/storage behavior.
- Crawl every possible application state: rejected as impractical; the plan uses risk-based representative flows plus a reviewed registry.

## Decision 7: Policy changes are release-controlled

**Decision**: Every policy has a version and effective date. Material changes to purpose, legal basis, recipient, consent category, or transfer behavior require a policy-version bump and a recorded renewed-consent/additional-notice decision.

**Rationale**: Git history alone shows code changes but does not demonstrate that consent scope was reconsidered. A policy release binds content, registry, decision, and audit evidence.

**Alternatives considered**:

- Automatically bump on every registry edit: rejected because formatting corrections and material purpose changes have different consequences.
- Manual prose update without release metadata: rejected because users and reviewers cannot identify the applicable version.

## Decision 8: Start privacy requests with a verified email route

**Decision**: Replace the GoAdopt portal with a local rights page and a dedicated privacy contact route. Explain verification, qualification, lawful exceptions, and response processing. Automated authenticated export/deletion is out of scope for this feature.

**Rationale**: This preserves an accessible route immediately without creating a high-risk automated deletion system. It also works for people without accounts.

**Alternatives considered**:

- Full automated request portal now: deferred because identity, data discovery, exceptions, deletion dependencies, and abuse handling deserve a separate feature.
- Generic support chat only: rejected because chat is optional and not a durable privacy-request channel.

## Tooling Constraint Found During Planning

The repository's Spec Kit template resolver and `setup-plan.ps1` fail on this Windows environment while invoking the discovered `python3.exe` shim (`StandardOutputEncoding is only supported when standard output is redirected`). The resolved base and `test-first-governance` templates were read directly and materialized without changing Spec Kit or Python configuration. This is a planning-tool defect, not a product defect.

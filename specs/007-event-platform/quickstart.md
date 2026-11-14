# Validation rehearsal

Follow docs/local-testing.md for disposable loopback PostgreSQL, job-owned templates and Chromium. Never load production secrets or push schema into shared databases.

1. Seed isolated partner creator, nonpartner creator, agency editor and new viewer plus deterministic Twitch/YouTube/storage/chat providers.
2. Configure the supplied pilot categories, both storage options and roadmap; publish announcement and inspect countdown.
3. Viewer signs in without creator onboarding, submits each source type, withdraws at quota and sees originals after team grouping.
4. Close submissions; inspect stable data snapshot. Review grouped rows and nominate.
5. Vote, revise, close with an already-open page; assert late writes rejected and results hidden.
6. Run every presenter slide, open media/text, chat reactions, result reveal and winner selection; rotate secret and reject old URL.
7. Publish explicitly and revisit archive. Nonpartner cannot list publicly; agency/editor cannot cross creator boundaries.
8. Repeat relevant responsive layouts in both themes with keyboard and provider failure recovery.

# Data Model

- events: UUID, creator owner FK, type awards, title (1..160), description (0..5000), visibility unlisted/public, publishedAt/resultsPublishedAt, timezone, schedule, global votesPerCategory (1..100), tie policy, closed-vote team tie decisions, result detail, deck/chat settings, revision, SHA256 presenter digest. Schedule must be finite and ordered; published state protects category/vote integrity.
- categories: UUID, event FK, title/group/order, source discriminator, selection mode audience/team/data, rules, submission limit nullable, nominee limit nullable, options and frozen result. No audience projection for data categories before publication.
- candidates: UUID, event/category FK, canonical source key unique within category, normalized media/text metadata, nomination flag, grouped parent nullable. Group children never independently nominated or publicly exposed.
- submissions: UUID, category FK, auth user FK, candidate FK, original payload, withdrawnAt. Active personal entries determine quota; grouping preserves originals.
- votes: category FK, auth user FK, candidate FK, unique triple. Mutations replace own selected set atomically under event lock and validate server phase after acquiring lock.
- storage connections: creator FK, provider s3/drive, encrypted credentials/provider auth reference, configuration, health. Accepted assets reference only validated creator-owned objects.

Freeze: at submission boundary snapshot counters from timestamped available source data, once per category; incomplete snapshots block data-result presentation rather than silently reading later counters. Existing creator locks precede event locks.

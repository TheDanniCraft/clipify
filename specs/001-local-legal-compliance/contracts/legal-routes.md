# Contract: Public Legal Routes

| Route                     | Audience                       | Required behavior                                                                                            |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `/legal/privacy`          | All visitors and users         | One versioned privacy notice based on the operator's EU/German baseline, with rights and contact information |
| `/legal/cookies`          | All visitors and users         | Complete reviewed service/storage inventory and consent entry point without runtime device inspection        |
| `/legal/terms`            | Prospective and existing users | Versioned service terms and operator-confirmed commercial rules                                              |
| `/legal/privacy-requests` | Any person                     | Rights overview, qualification, verification, contact route, processing expectations                         |
| `/imprint`                | All visitors                   | Existing provider identification, linked consistently from legal navigation                                  |

## Navigation requirements

- Footer and relevant account/login surfaces use local routes.
- Cookie banner links use local routes without opening an unrelated consent provider.
- Cookie preferences remain reachable from the cookie policy and footer in at most two interactions.
- Legal content is server-rendered and readable without client scripting.
- The cookie policy does not inspect or display the visitor's current browser-storage state.
- All routes expose title, effective date, version, and a consistent legal-navigation region.
- Superseded external GoAdopt URLs are absent from user-facing source and runtime network activity.

## Error and degraded behavior

- Missing content or metadata is a build/release error, not an empty production page.
- If consent preferences cannot load, legal content remains available and no preference change is represented as saved.
- The declared inventory remains complete without relying on browser-visible runtime state.

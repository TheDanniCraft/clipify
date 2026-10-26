# Reference research

## Checklist interactions

[Userflow's checklist documentation](https://help.userflow.com/userflow/docs/checklists) separates task actions from completion conditions. It describes a compact launcher with a circular remaining-task indicator and restores the checklist after task completion. This supports a small launcher and clickable rows rather than separate status chips and completion cards. The circular progress ring itself is the user's explicit preference and uses installed HeroUI ProgressCircle.

[Usertour's appearance rules](https://www.usertour.io/blog/how-usertour-start-rules-work) separate eligibility, repeat limits and temporary hiding. Apply that distinction here: account history decides whether onboarding is new; consent/dialog context decides whether guidance can display now. An existing overlay is an eligibility signal, not proof of OBS installation.

Read the actual [Usertour checklist implementation](https://github.com/usertour/usertour/blob/b08799bdd54a77ce1f8b3c5a23927b9fa7a60065/packages/widget/src/core/checklist.tsx) and [SDK checklist adapter](https://github.com/usertour/usertour/blob/b08799bdd54a77ce1f8b3c5a23927b9fa7a60065/apps/sdk/src/components/checklist.tsx). The implementation provides compact task rows and separates task activation from controlled status updates. Use these interaction principles, with Clipify's native HeroUI components and account model. No vendor source or assets were copied into the application.

[Appcues](https://appcues.helpjuice.com/checklists/what-are-checklists) likewise describes a persistent, self-serve floating entry point. Keep the four activation tasks clear and put optional discovery in collapsed sections; allow one expanded section here to avoid a tall panel.

## Clipify decisions

- Preserve Sentry's original bottom-right position and chat's bottom-left position. Place the compact ring launcher above feedback; do not reposition native widgets.
- The provider never pushes a page. Actual Dashboard logo, tab, edit button and menu actions teach how to reach the resource. Creation replay always returns to Add Overlay through user clicks.
- Separate navigation checkpoints from action checkpoints, so continuing from a different page teaches the route while retaining action progress.
- Progress is authoritative in PostgreSQL. Reuse `user_content_states`, authenticate by the active account, and serialize event updates. Existing resource facts suppress a new-user welcome on old accounts. Browser clearing changes neither task status nor dismissal preferences.
- Driver supplies geometry, but its default target ARIA annotations must not overwrite React Aria control state. Observe actual tab selection and menu appearance; preserve native popup focus.
- Keep skips distinct from domain success, and do not claim verified external installation. No extra completion card or permanent support paragraph.

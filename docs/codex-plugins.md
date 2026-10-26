# Clipify Codex plugins

Clipify registers Ponytail in `.agents/plugins/marketplace.json` and enables
`ponytail@clipify` through `.codex/config.toml`. The marketplace marks it
`INSTALLED_BY_DEFAULT` for clients supporting repository marketplaces. Project
configuration requires a trusted checkout.

Ponytail 5.3.2 is pinned to upstream commit
`09c434ab73ca43761c5d8b0c5d341926c2fba710` from
[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail).
Do not replace Clipify's `AGENTS.md` with the upstream instruction file.

## First setup

For Codex CLI, register the local marketplace from the checkout root and install:

```sh
codex plugin marketplace add .
codex plugin add ponytail@clipify
```

Codex's installer enables plugins at user scope. To keep this plugin limited to
Clipify, set the following in your personal `~/.codex/config.toml`; the committed
project configuration overrides it inside Clipify:

```toml
[plugins."ponytail@clipify"]
enabled = false
```

The installed plugin cache and personal preference are local state; only the
marketplace and project enablement are committed.

Restart/reload your Codex client, open Clipify, then open `/hooks`. Review and
trust the Ponytail hooks yourself before starting a new thread. Installation and
project enablement do not approve hook execution.

The pinned release declares three lifecycle hooks in
`hooks/claude-codex-hooks.json`: `SessionStart`, `SubagentStart` and
`UserPromptSubmit`. The upstream installation text currently says two; review
what the installed manifest actually lists. The scripts load the active rules,
provide them to subagents and track mode changes. Node.js must be available in
the execution environment.

In a fresh thread, use `$ponytail:ponytail-review` for a review, or
`$ponytail:ponytail` to switch modes. Existing Clipify instructions still apply.

## Verify installation

```sh
codex plugin list --marketplace clipify --json
```

Inside Clipify it should report version `5.3.2`, `installed: true`,
`enabled: true`, the official Git URL and the pinned commit. With the personal
setting above, it should report `enabled: false` outside the project.

To update, review an official upstream release, update the catalog's commit ref,
refresh/reinstall through Codex and review any changed hook definitions again.
Hook trust remains each developer's decision; never commit trust grants.

See [Ponytail installation](https://github.com/DietrichGebert/ponytail/blob/main/INSTALL.md)
and [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins).

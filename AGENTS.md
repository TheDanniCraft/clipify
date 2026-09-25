Gitmoji Guide for AI Assistants
Purpose

This guide helps AI assistants understand and use gitmoji convention when creating commits. Using emojis on commit messages provides an easy way of identifying the purpose or intention of a commit with only looking at the emojis used. Gitmoji use emojis to make commit messages more expressive and easier to understand at a glance.
Official Specification

A gitmoji commit message is composed using the following pieces:

    intention: The intention you want to express with the commit, using an emoji from the gitmoji list. Either in the :shortcode: or unicode format.
    scope: An optional string that adds contextual information for the scope of the change.
    message: A brief explanation of the change.

Format

<intention> [scope?][:?] <message>

[optional body]

Gitmoji reference

Fetch all available gitmojis from: https://gitmoji.dev/api/gitmojis.
Usage Guidelines for AI
Selecting the correct emoji

    Identify the primary purpose of the commit
    Choose the most specific emoji that matches the change
    Use only one emoji per commit for clarity
    Prioritize by impact: Breaking changes (💥) > Features (✨) > Fixes (🐛) > Refactoring (♻️)

Examples

✨ feat: Add user authentication system

Implement JWT-based authentication with login and registration endpoints.
Closes #123

🐛 Resolve null pointer exception in user service

Added null check before accessing user properties to prevent crashes.

📝 docs: Update installation instructions

Added step-by-step guide for setting up the development environment.

⚡️ Optimize user query with indexing

Reduced query time from 500ms to 50ms by adding composite index.

💥 Update API response format to REST specification

All API endpoints now return data in a standardized envelope format.
Clients must update their response parsing logic.

Best Practices

    Be atomic: One emoji, one purpose, one commit
    Write clear subjects: Keep under 60 characters, imperative mood
    Use the body: Explain "why" not "what" for complex changes
    Reference issues: Include issue numbers when applicable
    Indicate breaking changes: Use 💥 :boom:.

Resources

    Gitmojis list: https://gitmoji.dev/api/gitmojis
    Gitmoji website: https://gitmoji.dev/
    Gitmoji specification: https://gitmoji.dev/specification

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

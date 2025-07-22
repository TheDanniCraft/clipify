# Clipify

![Clipify Image](https://raw.githubusercontent.com/TheDanniCraft/clipify/refs/heads/master/public/og-image.png)

## Overview

Clipify automatically plays your best Twitch clips to keep your stream alive and your viewers entertained, even when you're away. Designed for streamers who want to keep their channel active, Clipify offers an intuitive interface, easy setup, and powerful features to engage your audience at all times.

_❗ **Note:** Clipify is open source, but currently not intended for self-hosting due to the way it is coded and managed. Please use the official hosted version on [clipify.us](https://clipify.us)._

## Features

- Auto-play Twitch Clips: Keep your stream alive by automatically playing your best clips when you're AFK.
- Easy to Use: Intuitive interface for effortless setup and management.
- Plug & Play: Add as a browser source to your streaming software.
- Player Control: Choose to play clips from today, all-time, or just your featured clips.
- Multiple Overlays: Create as many overlays as you like for different stream scenes.
- Channel Points Integration: (Coming soon) Let viewers play their favourite clips using Twitch channel points.
- Analytics Integration: Built-in support for Plausible Analytics.

## Getting Started

To get started with Clipify, simply visit [https://clipify.us](https://clipify.us) and log in with your Twitch account. No installation required!

## Pricing

- **Free:** Unlimited clips, one overlay, all core features.
- **Pro:** $1/month – Multiple overlays, channel points integration (coming soon), priority support, and more.

You can upgrade to Pro directly on [clipify.us](https://clipify.us).

---

### For local development (not intended for self-hosting)

1. **Clone the repository:**

   ```sh
   git clone https://github.com/TheDanniCraft/clipify.git
   cd clipify
   ```

2. **Install dependencies:**

   ```sh
   bun install
   ```

3. **Run the app in development mode:**

   ```sh
   bun run app:dev
   ```

### Database

Clipify uses [Drizzle ORM](https://orm.drizzle.team/) for database management. Example commands:

- Push schema: `bun run db:push`
- Generate migrations: `bun run db:generate`
- Run migrations: `bun run db:migrate`
- Open studio: `bun run db:studio`

### Linting

Run ESLint:

```sh
bun run app:lint
# or
npm run app:lint
```

### Building for Production

```sh
bun run app:build
# or
npm run app:build
```

Start the production server:

```sh
bun run app:start
# or
npm run app:start
```

## Docker

Official images are published to [ghcr.io/thedannicraft/clipify](https://github.com/TheDanniCraft/clipify/pkgs/container/clipify).

```sh
docker pull ghcr.io/thedannicraft/clipify:latest
# or use a specific tag from the GitHub release page
```

Example run:

```sh
docker run -p 3000:3000 ghcr.io/thedannicraft/clipify:latest
```

## Configuration

Environment variables are managed via [Infisical](https://infisical.com/).

## Scripts

| Script        | Description                                 |
| ------------- | ------------------------------------------- |
| `app:dev`     | Start development server with Infisical env |
| `app:build`   | Build Next.js app                           |
| `app:start`   | Start production server                     |
| `app:lint`    | Run ESLint                                  |
| `db:push`     | Push Drizzle schema (with Infisical env)    |
| `db:generate` | Generate Drizzle migrations                 |
| `db:migrate`  | Run Drizzle migrations                      |
| `db:studio`   | Open Drizzle studio (with Infisical env)    |

## Tech Stack

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Plausible Analytics](https://plausible.io/)
- [Sentry](https://sentry.io/)
- [Infisical](https://infisical.com/)

## License

[AGPL-3.0 license](https://github.com/TheDanniCraft/clipify#AGPL-3.0-1-ov-file)

<p align="center"><img src="docs/icon.png" width="128" alt="eggy icon"></p>

# eggy

macOS app that updates installed applications, Homebrew packages, and local git repositories.

![Home with upgrades waiting across applications, packages, and repositories](docs/screenshots/home.png)

## Applications

Scans `/Applications` and `~/Applications` for apps with a supported update feed:

- Sparkle appcasts
- electron-updater feeds
- per-app feeds for apps that resolve their feed at launch, such as Chrome, Cursor, Figma, and Ghostty

Each app shows installed and latest versions, release date, download size, and release notes when the feed provides them.

An upgrade downloads and unpacks the release, then verifies it. Sparkle releases are checked against the app's EdDSA key. Other releases must satisfy the installed app's designated code signing requirement and match the feed's checksum when one is published. The new bundle replaces the old one in place, and the old bundle moves to the Trash. Running apps are force quit and relaunched only after confirmation.

![CleanShot X with an upgrade available and its release notes](docs/screenshots/application.png)

## Packages

Lists installed Homebrew formulae and casks with installed and latest versions, including outdated dependencies. Checking runs `brew update` first. Upgrading runs `brew upgrade` for one package at a time and streams the output to the package page. Pinned packages and `auto_updates` casks are skipped, matching Homebrew's defaults.

![ffmpeg upgrading along with an outdated dependency](docs/screenshots/package.png)

## Repositories

Scans a configurable folder, `~/repo` by default, for git repositories whose current branch tracks an upstream, and shows ahead and behind counts. Pulling uses `git pull --ff-only`. Diverged branches can rebase with `git pull --rebase --autostash`. A rebase that stops on a conflict is aborted, restoring the branch and any stashed changes.

Selecting a commit shows its message and diff next to the history.

![The eggy repository with a commit diff open](docs/screenshots/repository.png)

## Development

```sh
pnpm install
pnpm dev
```

`pnpm build:mac` packages the app and signs it with a local code signing identity named `Local Development Code Signing`.

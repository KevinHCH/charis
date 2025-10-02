# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) to manage semantic versioning and changelog generation.

## Creating a release entry

1. Run `bun run changeset` and follow the prompts to describe the change and choose the appropriate semver bump.
2. Commit the generated file in `.changeset/` along with your code changes.
3. When the changes land on the default branch, run `bun run version-packages` to update `package.json`, `bun.lock`, and the changelog.
4. Commit the version bump and changelog updates.
5. Push the commit and create a tag that matches the new version (for example, `v0.2.0`). Pushing the tag triggers the release workflow that builds and publishes the binaries.

> **Note**
> Update the `repo` field in `.changeset/config.json` to match the GitHub repository that hosts this project so that changelog entries link to the correct commits and pull requests.

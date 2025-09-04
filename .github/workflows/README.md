# GitHub Actions Workflows

This directory contains the CI/CD workflows for the `@adampetrovich/cvmove` Salesforce CLI plugin.

## Workflows

### 1. `release-please.yml`

- **Purpose**: Automatically creates Release PRs when merging to `master`
- **Triggers**: Push to `master`, manual dispatch
- **Features**: Conventional commit analysis, changelog generation, version bumping
- **Dependencies**: Uses `GITHUB_TOKEN` (automatically provided)

### 2. `publish-npm.yml`

- **Purpose**: Securely publishes packages to npm with provenance
- **Triggers**: GitHub Release published, manual dispatch
- **Features**: OIDC authentication, supply chain attestation, test execution
- **Dependencies**: Uses `GITHUB_TOKEN` for OIDC authentication

### 3. `manual-release.yml`

- **Purpose**: Manual release triggers with version bump choices
- **Triggers**: Manual dispatch only
- **Features**: Version bump selection, dry run mode, comprehensive logging
- **Dependencies**: Uses `GITHUB_TOKEN` for authentication

### 4. `test.yml`

- **Purpose**: Runs unit tests and NUT (Not Unit Tests) for the plugin
- **Triggers**: Push to non-master branches, manual dispatch
- **Features**: Unit tests + NUT tests on multiple OS (Ubuntu, Windows)
- **Dependencies**: Uses Salesforce CLI's shared testing workflows

## Required Setup

### GitHub Secrets

**No additional secrets required!** The workflows use:

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- OIDC authentication for npm publishing (no personal access tokens needed)

### npm Configuration

- The package is configured with `"access": "public"` and `"provenance": true` in `package.json`
- OIDC authentication is used for secure npm publishing

## How It Works

1. **Development**: Make changes and commit with conventional commits
2. **Testing**: Push to feature branch triggers `test.yml` workflow
3. **Release**: Push to `master` triggers `release-please.yml` which creates a Release PR
4. **Publishing**: When Release PR is merged, GitHub release triggers `publish-npm.yml` which publishes to npm
5. **Manual**: Use `manual-release.yml` for manual releases with version bump choices

## Conventional Commits

Use conventional commit format for automatic version bumping:

- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `feat!:` or `fix!:` - Breaking changes (major version bump)
- `BREAKING CHANGE:` in footer - Alternative way to indicate breaking changes

## Troubleshooting

- **Workflows not running**: Check if GitHub Actions are enabled for the repository
- **Release not created**: Ensure commits follow conventional commit format
- **Publishing fails**: Check npm package configuration and OIDC setup

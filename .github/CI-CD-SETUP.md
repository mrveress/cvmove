# CI/CD Setup

This repository uses automated CI/CD workflows for version management and npm publishing.

## Workflows

- **Release Please** - Automatically creates Release PRs when pushing to `master`
- **Publish to npm** - Publishes packages to npm when GitHub releases are published
- **Manual Release** - Manual release triggers with version bump choices
- **Testing** - Runs unit tests and NUT tests on feature branches

## Setup Requirements

### 1. GitHub Repository Settings

- Enable GitHub Actions
- Configure branch protection for `master` branch
- Require status checks: `tests` and `Release Please`

### 2. npm Configuration

- Connect your GitHub repository to npm for OIDC authentication
- No additional secrets required

## Usage

### Automatic Release Process

1. Make changes and commit with conventional commits
2. Create a Pull Request to `master`
3. Merge the PR - this triggers the Release Please workflow
4. Review and merge the generated Release PR
5. The package is automatically published to npm

### Manual Release Process

1. Go to GitHub Actions → "Manual Release"
2. Click "Run workflow"
3. Choose version bump type: `patch`, `minor`, `major`, or `none`
4. Optionally enable dry run to test
5. Click "Run workflow"

## Conventional Commits

Use conventional commit format for automatic version bumping:

- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `feat!:` or `fix!:` - Breaking changes (major version bump)
- `BREAKING CHANGE:` in footer - Alternative way to indicate breaking changes

**Examples:**

```bash
git commit -m "feat: add new migration command"
git commit -m "fix: resolve authentication issue"
git commit -m "feat!: redesign API interface"
```

## Troubleshooting

- **Workflows not running**: Check if GitHub Actions are enabled
- **Release not created**: Ensure commits follow conventional commit format
- **Publishing fails**: Check npm package configuration and OIDC setup

## Security

- Uses OIDC authentication for npm publishing (no personal access tokens)
- All packages published with provenance for supply chain security
- Minimal permissions requested by workflows

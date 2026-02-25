#!/usr/bin/env bash
set -euo pipefail

TYPE="${1:-patch}"  # patch | minor | major

if [[ "$TYPE" != "patch" && "$TYPE" != "minor" && "$TYPE" != "major" ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

# Update version in package.json without creating a git tag yet
npm version "$TYPE" --no-git-tag-version

NEW_VERSION=$(node -p "require('./package.json').version")
echo "Bumped to v${NEW_VERSION}"

git add package.json

echo ""
echo "Next steps:"
echo "  1. Update CHANGELOG.md — add a '## [${NEW_VERSION}]' block at the top"
echo "  2. git add CHANGELOG.md"
echo "  3. git commit -m \"chore: release v${NEW_VERSION}\""
echo "  4. git tag v${NEW_VERSION}"
echo "  5. git push && git push --tags"
echo ""
echo "  Pushing the tag triggers .github/workflows/release.yml automatically."

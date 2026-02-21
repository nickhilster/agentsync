# Manual Publish TODO

## 1. Authenticate VS Code Marketplace (one-time)
- Create or verify publisher access for `Teambotics` in Azure DevOps / VS Marketplace.
- Create a Personal Access Token (PAT) with Marketplace publish permissions.
- In terminal, set it for current session:
  - PowerShell: `$env:VSCE_PAT = "<your_pat_here>"`

## 2. Publish extension
- Confirm version in `package.json` is correct for this release.
- Publish:
  - `npx @vscode/vsce@latest publish`
  - Or explicit version: `npx @vscode/vsce@latest publish 0.2.0`

## 3. Verify listing after publish
- Open:
  - `https://marketplace.visualstudio.com/items?itemName=Teambotics.agentsync`
- Confirm:
  - icon renders correctly
  - README displays without encoding issues
  - version/changelog match release

## 4. Smoke test from Marketplace install
- Install the marketplace version in a clean VS Code profile.
- Run:
  - `AgentSync: Initialize Workspace`
  - `AgentSync: Start Session`
  - `AgentSync: End Session`
- Confirm tracker updates and status bar behavior.

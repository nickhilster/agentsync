'use strict'

const { createNonce } = require('../utils')

/**
 * Build webview HTML for the animated AgentSync Live dashboard.
 * @returns {string}
 */
function getDashboardHtml() {
  const nonce = createNonce()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentSync Live</title>
  <style>
    :root {
      --bg: #060b08;
      --card: rgba(8, 18, 13, 0.82);
      --line: rgba(68, 112, 79, 0.5);
      --text: #d7ffe5;
      --muted: #9fc2aa;
      --ready: #1fd678;
      --busy: #ff4d57;
      --waiting: #ffb347;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background: var(--bg);
      font: 13px/1.45 "Consolas", "SFMono-Regular", "Menlo", monospace;
      overflow: hidden;
    }
    #matrix {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0.22;
      pointer-events: none;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background:
        radial-gradient(circle at 15% 0%, rgba(43, 130, 78, 0.18), transparent 38%),
        radial-gradient(circle at 85% 10%, rgba(20, 80, 55, 0.17), transparent 35%),
        linear-gradient(180deg, rgba(6, 13, 9, 0.9), rgba(2, 7, 4, 0.96));
      pointer-events: none;
    }
    .app {
      position: relative;
      z-index: 1;
      height: 100vh;
      overflow: auto;
      padding: 12px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .title {
      font-weight: 700;
      letter-spacing: 0.4px;
      margin-right: 4px;
    }
    .badge {
      border: 1px solid transparent;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
    }
    .badge.ready { color: #103a25; background: var(--ready); border-color: #86ffc2; }
    .badge.busy { color: #420e12; background: var(--busy); border-color: #ff9aa0; }
    .badge.waiting { color: #4a2e04; background: var(--waiting); border-color: #ffd898; }
    .pulse { color: var(--muted); opacity: 0.9; }
    .mode-toggle {
      margin-left: auto;
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.85);
      color: var(--text);
      border-radius: 7px;
      padding: 4px 8px;
      font: inherit;
      font-size: 11px;
      cursor: pointer;
    }
    .mode-toggle:hover {
      border-color: #6adf9a;
      background: rgba(15, 40, 24, 0.9);
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      gap: 7px;
      margin-bottom: 10px;
    }
    .actions.busy button.action,
    .compact-actions.busy button.action,
    .compact-more-actions.busy button.action {
      opacity: 0.65;
      cursor: wait;
    }
    button.action {
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.82);
      color: var(--text);
      border-radius: 8px;
      padding: 7px 8px;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    button.action:hover {
      border-color: #6adf9a;
      background: rgba(15, 40, 24, 0.9);
    }
    button.action.active-command,
    button.recovery-action.active-command {
      border-color: var(--active-command-color, #c8d2d8);
      background: var(--active-command-bg, rgba(19, 33, 24, 0.92));
      box-shadow:
        0 0 0 1px var(--active-command-color, #c8d2d8),
        0 0 12px -2px var(--active-command-color, #c8d2d8);
    }
    .compact-panel {
      margin-bottom: 10px;
      padding: 8px;
    }
    .compact-focus {
      margin-bottom: 6px;
      font-weight: 700;
      color: #c0f0d3;
    }
    .compact-task-list {
      margin: 0;
      padding-left: 16px;
      max-height: 90px;
      overflow: auto;
    }
    .compact-task-list li {
      margin: 3px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .compact-task-list li.empty {
      list-style: none;
      margin-left: -16px;
      color: var(--muted);
    }
    .compact-more-count {
      min-height: 16px;
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
    }
    .compact-actions {
      margin-top: 6px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 5px;
    }
    .compact-more-actions {
      margin-top: 5px;
      display: none;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 5px;
    }
    .compact-more-actions.open {
      display: grid;
    }
    button.action.compact-action {
      font-size: 11px;
      padding: 4px 6px;
      min-height: 28px;
      border-radius: 7px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
      gap: 8px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card);
      padding: 9px;
      backdrop-filter: blur(2px);
    }
    .card h3 {
      margin: 0 0 7px 0;
      font-size: 12px;
      letter-spacing: 0.3px;
      color: #c0f0d3;
      text-transform: uppercase;
    }
    .kv {
      margin: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 8px;
      row-gap: 4px;
    }
    .kv dt { color: var(--muted); }
    .kv dd { margin: 0; }
    ul.list {
      margin: 0;
      padding-left: 16px;
      max-height: 220px;
      overflow: auto;
    }
    ul.list li { margin: 3px 0; }
    li.empty { color: var(--muted); list-style: none; margin-left: -16px; }
    .hint {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .handoff-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 9px;
      margin-bottom: 6px;
    }
    .handoff-card-summary {
      font-size: 12px;
      font-weight: 600;
    }
    .handoff-card-meta {
      color: var(--muted);
      font-size: 11px;
      margin-top: 3px;
    }
    .handoff-card-actions {
      display: flex;
      gap: 5px;
      margin-top: 6px;
    }
    .handoff-card-actions button {
      font-size: 11px;
      padding: 3px 7px;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.82);
      color: var(--text);
      cursor: pointer;
    }
    .handoff-card-actions button:hover {
      border-color: #6adf9a;
    }
    .status-pill {
      display: inline-block;
      border-radius: 8px;
      padding: 1px 6px;
      border: 1px solid var(--line);
      margin-left: 5px;
      font-size: 11px;
      color: #d8ffe8;
    }
    .status-pass { border-color: #29ca72; color: #8df2b7; }
    .status-fail { border-color: #ff6c74; color: #ffb2b6; }
    .status-setup { border-color: #ffcf5a; color: #ffe08a; }
    .status-unknown { border-color: #888; color: #c9c9c9; }
    .action-center {
      margin-bottom: 10px;
    }
    .action-live {
      border-left: 3px solid #49cc83;
      padding-left: 8px;
      margin-bottom: 7px;
    }
    .action-live.running { border-left-color: #ffb347; }
    .action-live.error { border-left-color: #ff6c74; }
    .action-title {
      font-weight: 700;
      margin-bottom: 2px;
    }
    .checklist {
      margin: 8px 0 0 0;
      padding-left: 0;
      list-style: none;
    }
    .checklist li {
      margin: 4px 0;
      color: var(--muted);
    }
    .checklist li.done {
      color: #8df2b7;
    }
    .recovery {
      margin-top: 8px;
      display: none;
      gap: 6px;
      flex-wrap: wrap;
    }
    .recovery.visible {
      display: flex;
    }
    button.recovery-action {
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.82);
      color: var(--text);
      border-radius: 8px;
      padding: 5px 8px;
      font: inherit;
      cursor: pointer;
    }
    button.recovery-action:hover {
      border-color: #6adf9a;
      background: rgba(15, 40, 24, 0.9);
    }
    body[data-view-mode="compact"] .full-panel {
      display: none;
    }
    body[data-view-mode="full"] .compact-panel {
      display: none;
    }
  </style>
</head>
<body data-state="ready" data-view-mode="compact">
  <canvas id="matrix"></canvas>
  <div class="backdrop"></div>
  <div class="app">
    <div class="top">
      <div class="title">AgentSync Live</div>
      <span id="stateBadge" class="badge ready">READY</span>
      <span id="statePulse" class="pulse">[idle]</span>
      <span id="workspaceName" class="pulse"></span>
      <button id="modeToggle" class="mode-toggle" data-role="mode-toggle">Show Full</button>
    </div>

    <section id="compactPanel" class="card compact-panel">
      <h3>Current Focus</h3>
      <div id="compactFocus" class="compact-focus">No active goal</div>
      <ul id="compactTasks" class="compact-task-list"></ul>
      <div id="compactMoreCount" class="compact-more-count"></div>
      <div class="compact-actions">
        <button class="action compact-action" data-command="agentsync.startSession">Start Session</button>
        <button class="action compact-action" data-command="agentsync.endSession">End Session</button>
        <button class="action compact-action" data-command="agentsync.clearActiveSession">Clear Active Session</button>
        <button class="action compact-action" data-command="agentsync.openTracker">Open AgentTracker</button>
        <button class="action compact-action" data-role="compact-more-toggle">More</button>
      </div>
      <div id="compactMoreActions" class="compact-more-actions">
        <button class="action compact-action" data-command="agentsync.init">Initialize Workspace</button>
        <button class="action compact-action" data-command="agentsync.openHandoffs">Open Handoffs JSON</button>
        <button class="action compact-action" data-command="agentsync.contextCapsule">Generate Context Capsule</button>
        <button class="action compact-action" data-command="agentsync.syncAgencyRuns">Sync Agency Runs</button>
        <button class="action compact-action" data-command="agentsync.contextStatus">Context Status</button>
        <button class="action compact-action" data-command="agentsync.openTutorial">Open Walkthrough</button>
        <button class="action compact-action" data-command="agentsync.openDocs">Open Web Docs</button>
        <button class="action compact-action" data-command="agentsync.refreshPanel">Refresh</button>
      </div>
    </section>

    <div id="fullPanel" class="full-panel">
      <div class="actions">
        <button class="action" data-command="agentsync.init">Initialize Workspace</button>
        <button class="action" data-command="agentsync.startSession">Start Session</button>
        <button class="action" data-command="agentsync.endSession">End Session</button>
        <button class="action" data-command="agentsync.clearActiveSession">Clear Active Session</button>
        <button class="action" data-command="agentsync.openTracker">Open AgentTracker</button>
        <button class="action" data-command="agentsync.openHandoffs">Open Handoffs JSON</button>
        <button class="action" data-command="agentsync.contextCapsule">Generate Context Capsule</button>
        <button class="action" data-command="agentsync.syncAgencyRuns">Sync Agency Runs</button>
        <button class="action" data-command="agentsync.contextStatus">Context Status</button>
        <button class="action" data-command="agentsync.openTutorial">Open Walkthrough</button>
        <button class="action" data-command="agentsync.refreshPanel">Refresh</button>
      </div>

      <section class="card action-center">
        <h3>Action Center</h3>
        <div id="actionLive" class="action-live">
          <div id="actionTitle" class="action-title">Idle</div>
          <div id="actionDetail">Choose an action to begin.</div>
        </div>
        <div id="recoveryActions" class="recovery">
          <button class="recovery-action" data-command="agentsync.openTracker">Open Tracker</button>
          <button class="recovery-action" data-command="agentsync.refreshPanel">Refresh</button>
        </div>
        <dl class="kv">
          <dt>Next step</dt><dd id="nextStep">-</dd>
          <dt>Last update</dt><dd id="actionUpdated">-</dd>
          <dt>Data refreshed</dt><dd id="dataRefreshed">-</dd>
        </dl>
        <ul id="onboardingList" class="checklist"></ul>
      </section>

      <div class="grid">
        <section class="card">
          <h3>Overview</h3>
          <dl class="kv">
            <dt>State</dt><dd id="stateText">-</dd>
            <dt>Reason</dt><dd id="stateReason">-</dd>
            <dt>Open handoffs</dt><dd id="openHandoffs">0</dd>
            <dt>In progress</dt><dd id="inProgressCount">0</dd>
          </dl>
        </section>

        <section class="card">
          <h3>Session</h3>
          <dl class="kv">
            <dt>Active</dt><dd id="sessionActive">No</dd>
            <dt>Provider</dt><dd id="sessionProvider">None</dd>
            <dt>Personality</dt><dd id="sessionPersonality">None</dd>
            <dt>Goal</dt><dd id="sessionGoal">No active goal</dd>
            <dt>Started</dt><dd id="sessionStarted">-</dd>
          </dl>
        </section>

        <section class="card">
          <h3>Health</h3>
          <ul id="healthList" class="list"></ul>
        </section>

        <section class="card">
          <h3>Handoffs</h3>
          <div><strong>Assigned to me</strong></div>
          <ul id="handoffAssigned" class="list"></ul>
          <div style="margin-top: 6px;"><strong>Shared with me</strong></div>
          <ul id="handoffShared" class="list"></ul>
          <div style="margin-top: 6px;"><strong>Blocked / stale</strong></div>
          <ul id="handoffBlocked" class="list"></ul>
        </section>

        <section class="card" id="queuedHandoffsSection">
          <h3>Runnable Now</h3>
          <div id="queuedHandoffsList"></div>
        </section>

        <section class="card">
          <h3>Tracker</h3>
          <dl class="kv">
            <dt>Last agent</dt><dd id="lastAgent">-</dd>
            <dt>Last date</dt><dd id="lastDate">-</dd>
            <dt>Branch</dt><dd id="branch">-</dd>
            <dt>Commit</dt><dd id="commit">-</dd>
          </dl>
        </section>

        <section class="card">
          <h3>Personality Catalog</h3>
          <div id="agentCatalogSection"></div>
        </section>

        <section class="card">
          <h3>Pipelines</h3>
          <div id="pipelinesSection"></div>
        </section>

        <section class="card">
          <h3>Warnings</h3>
          <ul id="warningsList" class="list"></ul>
        </section>
      </div>
      <div class="hint">Tip: this live view auto-refreshes from AgentTracker + .agentsync files.</div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let pendingCommand = null;
    let lastActionAt = null;
    let currentViewMode = 'compact';
    let compactMoreOpen = false;

    const commandLabels = {
      'agentsync.init': 'Initialize Workspace',
      'agentsync.startSession': 'Start Session',
      'agentsync.runNextStep': 'Run Next Step',
      'agentsync.endSession': 'End Session',
      'agentsync.clearActiveSession': 'Clear Active Session',
      'agentsync.openTracker': 'Open AgentTracker',
      'agentsync.openConfig': 'Open .agentsync.json',
      'agentsync.openHandoffs': 'Open Handoffs JSON',
      'agentsync.contextCapsule': 'Generate Context Capsule',
      'agentsync.syncAgencyRuns': 'Sync Agency Runs',
      'agentsync.detectCommands': 'Detect Commands',
      'agentsync.contextStatus': 'Context Status',
      'agentsync.openTutorial': 'Open Walkthrough',
      'agentsync.openDocs': 'Open Web Docs',
      'agentsync.refreshPanel': 'Refresh'
    };
    const commandColors = {
      'agentsync.init': '#4fb3ff',
      'agentsync.startSession': '#1fd678',
      'agentsync.runNextStep': '#7fd8ff',
      'agentsync.endSession': '#ffb347',
      'agentsync.clearActiveSession': '#ff6c74',
      'agentsync.openTracker': '#8ab4ff',
      'agentsync.openConfig': '#8ab4ff',
      'agentsync.openHandoffs': '#8ab4ff',
      'agentsync.contextCapsule': '#7fd8ff',
      'agentsync.syncAgencyRuns': '#7ccf8a',
      'agentsync.detectCommands': '#ffcf5a',
      'agentsync.contextStatus': '#c59cff',
      'agentsync.openTutorial': '#8ab4ff',
      'agentsync.openDocs': '#8ab4ff',
      'agentsync.refreshPanel': '#3dd6d0'
    };

    function byId(id) {
      return document.getElementById(id);
    }

    function setText(id, value) {
      const el = byId(id);
      if (el) el.textContent = value == null ? '-' : String(value);
    }

    function formatTime(value) {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleTimeString();
    }

    function normalizeMode(mode) {
      return mode === 'full' ? 'full' : 'compact';
    }

    function setViewMode(mode) {
      currentViewMode = normalizeMode(mode);
      document.body.dataset.viewMode = currentViewMode;
      const toggle = byId('modeToggle');
      if (toggle) {
        toggle.textContent = currentViewMode === 'compact' ? 'Show Full' : 'Show Compact';
      }
    }

    function setCompactMoreOpen(nextOpen) {
      compactMoreOpen = Boolean(nextOpen);
      const moreActions = byId('compactMoreActions');
      if (moreActions) {
        moreActions.classList.toggle('open', compactMoreOpen);
      }
      const toggle = document.querySelector('[data-role="compact-more-toggle"]');
      if (toggle) {
        toggle.textContent = compactMoreOpen ? 'Less' : 'More';
      }
    }

    function toRgba(hex, alpha) {
      const normalized = String(hex || '').trim().replace('#', '');
      if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) {
        return 'rgba(200, 210, 216, ' + alpha + ')';
      }
      const expanded = normalized.length === 3
        ? normalized.split('').map((c) => c + c).join('')
        : normalized;
      const r = parseInt(expanded.slice(0, 2), 16);
      const g = parseInt(expanded.slice(2, 4), 16);
      const b = parseInt(expanded.slice(4, 6), 16);
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    }

    function getCommandColor(command) {
      return commandColors[command] || '#c8d2d8';
    }

    function renderShortcuts(shortcuts) {
      const makeButton = (cmd) => {
        const btn = document.createElement('button');
        btn.className = 'action';
        btn.setAttribute('data-command', cmd);
        const fallbackLabel = cmd.includes('.') ? cmd.slice(cmd.lastIndexOf('.') + 1) : cmd;
        btn.textContent = commandLabels[cmd] || fallbackLabel;
        const color = getCommandColor(cmd);
        btn.style.setProperty('--button-color', color);
        return btn;
      };
      const compactContainer = document.querySelector('.compact-actions');
      const fullContainer = document.querySelector('.actions');
      [compactContainer, fullContainer].forEach((container) => {
        if (!container) return;
        container.innerHTML = '';
        shortcuts.forEach((cmd) => {
          const btn = makeButton(cmd);
          container.appendChild(btn);
        });
      });
    }

    function clearActiveCommandHighlight() {
      const highlighted = document.querySelectorAll('button.action.active-command, button.recovery-action.active-command');
      highlighted.forEach((button) => {
        button.classList.remove('active-command');
        button.style.removeProperty('--active-command-color');
        button.style.removeProperty('--active-command-bg');
      });
    }

    function setActiveCommandHighlight(command) {
      clearActiveCommandHighlight();
      const color = getCommandColor(command);
      const tint = toRgba(color, 0.18);
      const targets = document.querySelectorAll('[data-command="' + command + '"]');
      targets.forEach((target) => {
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('button.action, button.recovery-action')) return;
        target.classList.add('active-command');
        target.style.setProperty('--active-command-color', color);
        target.style.setProperty('--active-command-bg', tint);
      });
    }

    function formatCompactTask(value) {
      const text = String(value || '').replace(/\\s+/g, ' ').trim();
      if (!text) return '-';
      if (text.length <= 90) return text;
      return text.slice(0, 89) + '...';
    }

    function setActionVisual(state, title, detail) {
      const live = byId('actionLive');
      if (live) {
        live.classList.remove('running', 'error');
        if (state === 'running') live.classList.add('running');
        if (state === 'error') live.classList.add('error');
      }
      setText('actionTitle', title);
      setText('actionDetail', detail);
      setText('actionUpdated', formatTime(lastActionAt));
    }

    function setRecoveryVisible(isVisible) {
      const el = byId('recoveryActions');
      if (!el) return;
      el.classList.toggle('visible', Boolean(isVisible));
    }

    function setActionsBusy(isBusy) {
      const actionContainers = document.querySelectorAll('.actions, .compact-actions, .compact-more-actions');
      actionContainers.forEach((container) => {
        container.classList.toggle('busy', Boolean(isBusy));
      });

      const buttons = document.querySelectorAll('button.action[data-command], button.recovery-action[data-command]');
      buttons.forEach((button) => {
        const command = button.getAttribute('data-command');
        const keepEnabled = command === 'agentsync.refreshPanel';
        button.disabled = isBusy && !keepEnabled;
      });
    }

    function renderList(id, items, format, emptyLabel) {
      const el = byId(id);
      if (!el) return;
      el.innerHTML = '';
      if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = emptyLabel;
        el.appendChild(li);
        return;
      }
      items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = format(item);
        el.appendChild(li);
      });
    }

    function healthClass(status) {
      const normalized = String(status || '').toLowerCase();
      if (normalized === 'pass') return 'status-pass';
      if (normalized === 'fail') return 'status-fail';
      if (normalized === 'not configured') return 'status-setup';
      return 'status-unknown';
    }

    function renderHealth(health) {
      const rows = [
        { name: 'Build', status: health.Build },
        { name: 'Tests', status: health.Tests },
        { name: 'Deploy', status: health.Deploy }
      ];
      const el = byId('healthList');
      if (!el) return;
      el.innerHTML = '';
      var needsSetup = false;
      rows.forEach((row) => {
        const li = document.createElement('li');
        const pill = document.createElement('span');
        pill.className = 'status-pill ' + healthClass(row.status);
        const normalized = String(row.status || '');
        if (normalized === 'Not configured') needsSetup = true;
        pill.textContent = normalized === 'Not configured' ? 'Setup needed' : row.status;
        li.textContent = row.name + ': ';
        li.appendChild(pill);
        el.appendChild(li);
      });
      if (needsSetup) {
        const hint = document.createElement('li');
        hint.textContent = 'Configure build/test/deploy commands to unlock end-session health checks.';
        el.appendChild(hint);

        const actions = document.createElement('li');
        actions.style.listStyle = 'none';
        actions.style.marginLeft = '-16px';
        actions.style.marginTop = '6px';

        var detectBtn = document.createElement('button');
        detectBtn.className = 'action compact-action';
        detectBtn.textContent = 'Detect Commands';
        detectBtn.setAttribute('data-command', 'agentsync.detectCommands');
        actions.appendChild(detectBtn);

        var openBtn = document.createElement('button');
        openBtn.className = 'action compact-action';
        openBtn.style.marginLeft = '6px';
        openBtn.textContent = 'Open .agentsync.json';
        openBtn.setAttribute('data-command', 'agentsync.openConfig');
        actions.appendChild(openBtn);

        el.appendChild(actions);
      }
    }

    function formatHandoff(item) {
      return item.id + ' | ' + item.summary + ' (' + item.status + ', ' + item.mode + ')';
    }

    function renderQueuedHandoffs(handoffs) {
      const container = byId('queuedHandoffsList');
      if (!container) return;
      container.innerHTML = '';
      if (!handoffs || handoffs.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.style.cssText = 'color:var(--muted);font-size:12px;margin:4px 0;';
        empty.textContent = 'No runnable queued handoffs for this provider.';
        container.appendChild(empty);
        return;
      }
      handoffs.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'handoff-card';

        const summaryEl = document.createElement('div');
        summaryEl.className = 'handoff-card-summary';
        summaryEl.textContent = item.summary;
        card.appendChild(summaryEl);

        const metaEl = document.createElement('div');
        metaEl.className = 'handoff-card-meta';
        metaEl.textContent = 'From: ' + item.from_agent + ' | Provider: ' + item.to_agents_display + ' | Files: ' + item.files_display;
        card.appendChild(metaEl);

        const personalityEl = document.createElement('div');
        personalityEl.className = 'handoff-card-meta';
        personalityEl.textContent = 'Personality: ' + item.personality;
        card.appendChild(personalityEl);

        if (item.recommended_model_tier) {
          const tierEl = document.createElement('span');
          tierEl.style.cssText = 'display:inline-block;padding:1px 6px;border-radius:3px;font-size:0.75em;margin-top:4px;' +
            (item.recommended_model_tier === 'lead' ? 'background:#ffb347;color:#1a1a1a;' : 'background:#3dd6d0;color:#1a1a1a;');
          tierEl.textContent = item.recommended_model_tier === 'lead' ? 'Lead Model' : 'Worker Model';
          if (item.model_justification) tierEl.title = item.model_justification;
          card.appendChild(tierEl);
        }

        if (item.stale_observation) {
          const staleEl = document.createElement('div');
          staleEl.style.cssText = 'background: #ffb347; color: #1a1a1a; padding: 2px 6px; border-radius: 3px; font-size: 0.75em; margin-top: 4px;';
          staleEl.textContent = '⚠ Context may be outdated — re-read these files';
          card.appendChild(staleEl);
        }

        if (item.notes) {
          const notesEl = document.createElement('div');
          notesEl.className = 'handoff-card-meta';
          notesEl.textContent = 'Notes: ' + item.notes;
          card.appendChild(notesEl);
        }

        const actions = document.createElement('div');
        actions.className = 'handoff-card-actions';

        const claimBtn = document.createElement('button');
        claimBtn.textContent = 'Claim';
        claimBtn.setAttribute('data-handoff-action', 'claim');
        claimBtn.setAttribute('data-handoff-id', item.id);
        actions.appendChild(claimBtn);

        const startBtn = document.createElement('button');
        startBtn.textContent = 'Start';
        startBtn.setAttribute('data-handoff-action', 'start');
        startBtn.setAttribute('data-handoff-id', item.id);
        actions.appendChild(startBtn);

        const skipBtn = document.createElement('button');
        skipBtn.textContent = 'Skip';
        skipBtn.setAttribute('data-handoff-action', 'skip');
        skipBtn.setAttribute('data-handoff-id', item.id);
        actions.appendChild(skipBtn);

        card.appendChild(actions);
        container.appendChild(card);
      });
    }

    function renderCompactSummary(compactModel) {
      setText('compactFocus', compactModel.focusText || 'No active goal');
      const compactTasks = Array.isArray(compactModel.tasks) ? compactModel.tasks : [];
      renderList('compactTasks', compactTasks, (item) => formatCompactTask(item), 'No in-progress tasks');
      const count = Number(compactModel.extraTaskCount) || 0;
      const countEl = byId('compactMoreCount');
      if (countEl) {
        countEl.textContent = count > 0 ? '+' + count + ' more task' + (count === 1 ? '' : 's') : '';
      }
    }

    function renderOnboarding(onboarding) {
      const el = byId('onboardingList');
      if (!el) return;
      const stepRows = [
        {
          done: Boolean(onboarding && onboarding.initialized),
          label: '1. Initialize workspace'
        },
        {
          done: Boolean(onboarding && onboarding.started),
          label: '2. Start first session'
        },
        {
          done: Boolean(onboarding && onboarding.ended),
          label: '3. End session and hand off'
        }
      ];
      el.innerHTML = '';
      stepRows.forEach((row) => {
        const li = document.createElement('li');
        li.className = row.done ? 'done' : '';
        li.textContent = (row.done ? '[x] ' : '[ ] ') + row.label;
        el.appendChild(li);
      });
    }

    function getRunningHint(command, label) {
      if (command === 'agentsync.startSession') {
        return 'You may see prompts for provider and goal. Fill those in, then wait for completion.';
      }
      if (command === 'agentsync.runNextStep') {
        return 'AgentSync is claiming the next step, activating the suggested personality, and copying the prompt.';
      }
      if (command === 'agentsync.endSession') {
        return 'You may see prompts for summary and next work. Complete them, then wait for confirmation.';
      }
      if (command === 'agentsync.init') {
        return 'AgentSync files are being created now. You will see completion once file writes finish.';
      }
      return 'Watch for prompts in VS Code. This view will update when complete.';
    }

    function getFailureHint(command, message) {
      const base = message || 'The command failed.';
      if (command === 'agentsync.startSession' || command === 'agentsync.endSession') {
        return base + ' Open Tracker to review required fields, then try again.';
      }
      if (command === 'agentsync.init') {
        return base + ' Check workspace permissions and try Initialize Workspace again.';
      }
      return base + ' Try Refresh. If it persists, open AgentTracker for context.';
    }

    function renderAgentCatalog(catalog) {
      const el = byId('agentCatalogSection');
      if (!el) return;
      el.innerHTML = '';
      if (!catalog || !catalog.loaded || catalog.totalAgents === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'color:var(--muted);font-size:12px;margin:4px 0;';
        empty.textContent = 'Agent catalog not loaded.';
        el.appendChild(empty);
        return;
      }

      const header = document.createElement('div');
      header.style.cssText = 'margin-bottom:6px;font-size:12px;color:var(--muted);';
      header.textContent = catalog.totalAgents + ' LLM-agnostic personalities available';
      el.appendChild(header);

      const badgeContainer = document.createElement('div');
      badgeContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
      (catalog.categories || []).forEach(function(cat) {
        const badge = document.createElement('span');
        badge.style.cssText = 'display:inline-block;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600;' +
          'background:' + cat.color + '22;color:' + cat.color + ';border:1px solid ' + cat.color + '44;';
        badge.textContent = cat.name + ' (' + cat.count + ')';
        badge.title = cat.name + ': ' + cat.count + ' agent(s)';
        badgeContainer.appendChild(badge);
      });
      el.appendChild(badgeContainer);

      const actions = document.createElement('div');
      actions.style.cssText = 'margin-top:6px;display:flex;gap:6px;';

      var browseBtn = document.createElement('button');
      browseBtn.className = 'action compact-action';
      browseBtn.textContent = 'Browse Personalities';
      browseBtn.setAttribute('data-command', 'agentsync.browseAgents');
      actions.appendChild(browseBtn);

      var runBtn = document.createElement('button');
      runBtn.className = 'action compact-action';
      runBtn.textContent = 'Run with Personality';
      runBtn.setAttribute('data-command', 'agentsync.runWithAgent');
      actions.appendChild(runBtn);

      var pipelineBtn = document.createElement('button');
      pipelineBtn.className = 'action compact-action';
      pipelineBtn.textContent = 'Create Pipeline';
      pipelineBtn.setAttribute('data-command', 'agentsync.createPipeline');
      actions.appendChild(pipelineBtn);

      el.appendChild(actions);
    }

    function renderPipelines(pipelines) {
      var el = byId('pipelinesSection');
      if (!el) return;
      el.innerHTML = '';
      if (!pipelines || pipelines.length === 0) {
        var empty = document.createElement('p');
        empty.style.cssText = 'color:var(--muted);font-size:12px;margin:4px 0;';
        empty.textContent = 'No active pipelines.';
        el.appendChild(empty);
        return;
      }

      pipelines.forEach(function(pipeline) {
        var row = document.createElement('div');
        row.style.cssText = 'margin-bottom:8px;';

        var label = document.createElement('div');
        label.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:4px;';
        label.textContent = 'Chain: ' + pipeline.chainId;
        row.appendChild(label);

        var stepsContainer = document.createElement('div');
        stepsContainer.style.cssText = 'display:flex;align-items:center;gap:2px;flex-wrap:wrap;';

        pipeline.steps.forEach(function(step, idx) {
          var stepEl = document.createElement('div');
          var statusColors = {
            blocked: '#666',
            queued: '#ffb347',
            in_progress: '#3b82f6',
            merged: '#22c55e',
            approved: '#22c55e',
            ready_for_review: '#a855f7'
          };
          var bg = statusColors[step.status] || '#666';
          stepEl.style.cssText = 'display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;font-size:11px;' +
            'background:' + bg + '22;color:' + bg + ';border:1px solid ' + bg + '44;cursor:default;';
          stepEl.textContent = step.step + '. ' + (step.agentName || '').split('/').pop();
          stepEl.title = step.summary + ' (' + step.status + ')';
          stepsContainer.appendChild(stepEl);

          if (idx < pipeline.steps.length - 1) {
            var arrow = document.createElement('span');
            arrow.style.cssText = 'color:var(--muted);font-size:12px;margin:0 2px;';
            arrow.textContent = '→';
            stepsContainer.appendChild(arrow);
          }
        });

        row.appendChild(stepsContainer);
        el.appendChild(row);
      });
    }

    function render(model) {
      if (!model || !model.hasWorkspace) {
        setViewMode('compact');
        setCompactMoreOpen(false);
        clearActiveCommandHighlight();
        setActionsBusy(false);
        renderShortcuts([]);
        setText('stateText', 'No workspace open');
        setText('nextStep', 'Open a folder/workspace to use AgentSync.');
        setText('compactFocus', 'No workspace open');
        renderList('compactTasks', [], (item) => formatCompactTask(item), 'No in-progress tasks');
        setText('compactMoreCount', '');
        return;
      }

      setViewMode(model.ui && model.ui.viewMode);
      renderShortcuts(model.shortcuts || []);

      document.body.dataset.state = model.state.key;
      const badge = byId('stateBadge');
      if (badge) {
        badge.className = 'badge ' + model.state.key;
        badge.textContent = String(model.state.label || '').toUpperCase();
      }
      setText('statePulse', model.state.pulse);
      setText('workspaceName', model.workspace);

      setText('stateText', model.state.label);
      setText('stateReason', model.state.reason);
      setText('openHandoffs', model.handoffs.openCount);
      setText('inProgressCount', model.inProgress.length);
      setText('nextStep', model.nextStep || '-');
      setText('dataRefreshed', formatTime(model.refreshedAt));
      renderCompactSummary(model.compact || {});

      setText('sessionActive', model.session.active ? 'Yes' : 'No');
      setText('sessionProvider', model.session.provider);
      setText('sessionPersonality', model.session.personality);
      setText('sessionGoal', model.session.goal);
      setText('sessionStarted', model.session.startedAt ? new Date(model.session.startedAt).toLocaleString() : '-');
      renderOnboarding(model.onboarding || {});

      setText('lastAgent', model.tracker.lastAgent);
      setText('lastDate', model.tracker.lastDate);
      setText('branch', model.tracker.branch);
      setText('commit', model.tracker.commit);

      renderHealth(model.health);
      renderList('handoffAssigned', model.handoffs.assignedToMe, formatHandoff, 'No direct assignments');
      renderList('handoffShared', model.handoffs.sharedWithMe, formatHandoff, 'No shared assignments');
      renderList('handoffBlocked', model.handoffs.blockedOrStale, formatHandoff, 'No blocked/stale handoffs');
      renderQueuedHandoffs(model.handoffs.queued || []);
      renderAgentCatalog(model.agentCatalog || {});
      renderPipelines(model.pipelines || []);
      renderList('warningsList', model.warnings, (w) => w, 'No warnings');

      if (!pendingCommand) {
        clearActiveCommandHighlight();
        const statusLabel = model.state && model.state.label ? model.state.label : 'Idle';
        setActionVisual('ok', 'Idle', 'Current state: ' + statusLabel + '.');
        setRecoveryVisible(false);
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data || {};
      if (msg.type === 'model') render(msg.model);
      if (msg.type === 'action') {
        const stage = String(msg.stage || '');
        const command = String(msg.command || '');
        const label = commandLabels[command] || command || 'Action';
        lastActionAt = msg.timestamp || new Date().toISOString();

        if (stage === 'started') {
          pendingCommand = command;
          setActionsBusy(true);
          setActiveCommandHighlight(command);
          setActionVisual(
            'running',
            'Running: ' + label,
            getRunningHint(command, label)
          );
          setRecoveryVisible(false);
          return;
        }

        if (stage === 'completed') {
          pendingCommand = null;
          setActionsBusy(false);
          clearActiveCommandHighlight();
          setActionVisual('ok', 'Completed: ' + label, 'Action finished successfully.');
          setRecoveryVisible(false);
          return;
        }

        if (stage === 'failed') {
          pendingCommand = null;
          setActionsBusy(false);
          clearActiveCommandHighlight();
          setActionVisual('error', 'Failed: ' + label, getFailureHint(command, msg.error || ''));
          setRecoveryVisible(true);
        }
      }
    });

    document.addEventListener('click', (event) => {
      const modeToggle = event.target.closest('[data-role="mode-toggle"]');
      if (modeToggle) {
        const next = currentViewMode === 'compact' ? 'full' : 'compact';
        vscode.postMessage({ type: 'ui', action: 'setMode', mode: next });
        return;
      }

      const moreToggle = event.target.closest('[data-role="compact-more-toggle"]');
      if (moreToggle) {
        setCompactMoreOpen(!compactMoreOpen);
        return;
      }

      // Handoff card action buttons (Claim / Start / Skip)
      const handoffBtn = event.target.closest('[data-handoff-action]');
      if (handoffBtn) {
        const action = handoffBtn.getAttribute('data-handoff-action');
        const handoffId = handoffBtn.getAttribute('data-handoff-id');
        if (action && handoffId) {
          vscode.postMessage({ type: 'handoff-action', action, handoffId });
        }
        return;
      }

      const target = event.target.closest('[data-command]');
      if (!target) return;
      const command = target.getAttribute('data-command');
      if (!command) return;
      if (pendingCommand && command !== 'agentsync.refreshPanel') return;
      vscode.postMessage({ command });
    });

    (function startMatrix() {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const canvas = byId('matrix');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-';
      const fontSize = 14;
      let cols = 0;
      let drops = [];

      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        cols = Math.max(1, Math.floor(canvas.width / fontSize));
        drops = Array(cols).fill(1);
      };

      const draw = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#20f080';
        ctx.font = fontSize + 'px monospace';
        for (let i = 0; i < drops.length; i += 1) {
          const text = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
          drops[i] += 1;
        }
      };

      resize();
      window.addEventListener('resize', resize);
      setInterval(draw, 60);
    })();

    setViewMode('compact');
    setCompactMoreOpen(false);
    vscode.postMessage({ command: 'agentsync.refreshPanel' });
  </script>
</body>
</html>`
}

module.exports = { getDashboardHtml }

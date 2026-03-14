export function renderHudBar() {
  return `
    <header class="hud-bar ui-card">
      <div class="hud-row">
        <h1>Jungle Game</h1>
        <div class="hud-actions">
          <button id="openLeaderboardBtn" class="ghost-btn" type="button" title="Open global leaderboard">Leaderboard</button>
          <button id="debugToggleBtn" class="ghost-btn" type="button" title="Toggle performance debug panel">Debug</button>
          <button id="inspectorToggleBtn" class="ghost-btn" type="button" title="Toggle stat breakdown inspector">Inspector</button>
          <button id="resetProgressBtn" class="ghost-btn" type="button" title="Reset all game progress in the active save slot">Reset Progress</button>
          <button id="openCustomizeBtn" class="ghost-btn" type="button" title="Customize top bar, body, and profile icon style">Customize</button>
          <button id="openSettingsBtn" class="ghost-btn" type="button" title="Open game settings">Settings</button>
        </div>
      </div>
      <div class="hud-stats">
        <div class="hud-stat"><span>Bananas</span><strong id="bananasText">0</strong></div>
        <div class="hud-stat"><span>Cash</span><strong id="cashText">0</strong></div>
        <div class="hud-stat"><span>Bananas/sec</span><strong id="bpsText">0</strong></div>
        <div class="hud-stat"><span>Click Yield</span><strong id="clickYieldText">0</strong></div>
        <div class="hud-stat"><span>Active Buyer Bonus</span><strong id="buyerBonusText">0%</strong></div>
      </div>
      <div class="news-ticker" title="Timed global events impact your run.">
        <p id="eventNameText">Event: No active event</p>
        <p id="eventDetailText">Effects and timers will appear here.</p>
      </div>
      <div id="debugPanel" class="debug-panel is-hidden" aria-live="polite">
        <p id="debugTickText">Tick: 0.00ms</p>
        <p id="debugRenderText">Render: 0.00ms</p>
        <p id="debugFpsText">Render FPS: 0.00</p>
      </div>
      <div id="statInspectorPanel" class="stat-inspector is-hidden" aria-live="polite">
        <p id="inspectorProductionText">Production: 1.00x</p>
        <p id="inspectorClickText">Click: 1.00x</p>
        <p id="inspectorExportText">Export: 1.00x</p>
        <p id="inspectorCooldownText">Cooldown: 1.00x</p>
        <p id="inspectorHarvestText">Harvest yield/pick: 1.00</p>
        <p id="inspectorSpawnText">Spawn interval: 1.50s</p>
        <p id="inspectorWorkerText">Worker output: 0.00/s</p>
        <p id="inspectorOrchardText">Orchard picks: 0.00/s</p>
        <p id="inspectorPricesText">Market/AutoSell: $0.00 / $0.00</p>
        <p id="inspectorSourcesText">Sources: Prestige 1.00x | PIP 1.00x | Achievements 1.00x | Research rows 1.00x | Evolution 1.00x | Account 1.00x</p>
      </div>
    </header>
  `;
}

export function renderHudBar() {
  return `
    <header class="hud-bar ui-card">
      <div class="hud-row">
        <h1>Jungle Game</h1>
        <div class="hud-actions">
          <button id="openLeaderboardBtn" class="ghost-btn" type="button" title="Open global leaderboard">Leaderboard</button>
          <button id="debugToggleBtn" class="ghost-btn" type="button" title="Toggle performance debug panel">Debug</button>
          <button id="resetProgressBtn" class="ghost-btn" type="button" title="Reset all game progress in the active save slot">Reset Progress</button>
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
    </header>
  `;
}

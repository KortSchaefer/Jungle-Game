export function renderLeaderboardModal() {
  return `
    <div id="leaderboardModal" class="settings-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="leaderboardTitle">
      <div class="settings-backdrop" data-close-leaderboard="true"></div>
      <div class="settings-content ui-card leaderboard-content">
        <div class="settings-head">
          <h3 id="leaderboardTitle">Global Leaderboard</h3>
          <div class="input-row">
            <button id="refreshLeaderboardBtn" class="ghost-btn" type="button">Refresh</button>
            <button id="closeLeaderboardBtn" class="ghost-btn" type="button">Close</button>
          </div>
        </div>
        <p id="leaderboardUpdatedText">Last updated: -</p>
        <p id="leaderboardStatusText">Loading leaderboard...</p>
        <p id="leaderboardProofText">Shared DB proof: pending.</p>
        <div id="leaderboardList" class="buyers-list"></div>
      </div>
    </div>
  `;
}

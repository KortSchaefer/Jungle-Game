export function renderCeoPanel() {
  return `
    <aside class="ceo-panel ui-card">
      <h2>Monkey CEO</h2>
      <div class="avatar-placeholder" aria-hidden="true">M</div>
      <label class="field-label" for="companyNameInput">Company Name</label>
      <input id="companyNameInput" type="text" maxlength="40" value="Monkey Banana Holdings" title="Rename your company" />
      <p id="ceoLevelText">Level 1</p>
      <div class="progress-wrap" title="Progress to next CEO level">
        <div id="ceoProgressFill" class="progress-fill"></div>
      </div>
      <p id="ceoProgressText">0%</p>
      <div class="player-stats-card">
        <h3>Player Stats</h3>
        <p id="playerTotalBananasText">Total Bananas: 0</p>
        <p id="playerTotalCashText">Total Cash: $0</p>
        <p id="playerTotalClicksText">Total Clicks: 0</p>
        <p id="playerTotalShipmentsText">Total Shipments: 0</p>
        <p id="playerContractsText">Contracts Completed: 0</p>
        <p id="playerTreesWorkersText">Trees / Workers: 0 / 0</p>
        <p id="playerPrestigeText">Prestige / PIP: 0 / 0</p>
      </div>
    </aside>
  `;
}

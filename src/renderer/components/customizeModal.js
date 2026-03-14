export function renderCustomizeModal() {
  return `
    <div id="customizeModal" class="settings-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="customizeTitle">
      <div class="settings-backdrop" data-close-customize="true"></div>
      <div class="settings-content customize-content ui-card">
        <div class="settings-head">
          <h3 id="customizeTitle">Customize</h3>
          <button id="closeCustomizeBtn" class="ghost-btn" type="button">Close</button>
        </div>

        <div class="ui-card">
          <h4>Theme</h4>
          <p id="customizeUnlockHintText">Higher account levels unlock additional themes and icon styles.</p>
          <label class="toggle-row" for="topBarThemeSelect">
            <span>Top Bar Theme</span>
            <select id="topBarThemeSelect"></select>
          </label>
          <label class="toggle-row" for="bodyThemeSelect">
            <span>Body Theme</span>
            <select id="bodyThemeSelect"></select>
          </label>
        </div>

        <div class="ui-card">
          <h4>Player Icon</h4>
          <label class="toggle-row" for="iconStyleSelect">
            <span>Icon Style</span>
            <select id="iconStyleSelect"></select>
          </label>
        </div>
      </div>
    </div>
  `;
}

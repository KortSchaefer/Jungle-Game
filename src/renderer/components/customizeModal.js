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
          <label class="toggle-row" for="topBarThemeSelect">
            <span>Top Bar Theme</span>
            <select id="topBarThemeSelect">
              <option value="forest">Forest</option>
              <option value="slate">Slate</option>
              <option value="sunset">Sunset</option>
            </select>
          </label>
          <label class="toggle-row" for="bodyThemeSelect">
            <span>Body Theme</span>
            <select id="bodyThemeSelect">
              <option value="meadow">Meadow</option>
              <option value="dusk">Dusk</option>
              <option value="sand">Sand</option>
            </select>
          </label>
        </div>

        <div class="ui-card">
          <h4>Player Icon</h4>
          <p>Icon packs and advanced avatar styles are planned for a later release.</p>
          <label class="toggle-row" for="iconStyleSelect">
            <span>Icon Style</span>
            <select id="iconStyleSelect">
              <option value="classic">Classic (Current)</option>
              <option value="future" disabled>Future Packs (Coming Soon)</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  `;
}

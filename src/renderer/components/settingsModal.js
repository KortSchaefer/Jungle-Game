export function renderSettingsModal() {
  return `
    <div id="settingsModal" class="settings-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div class="settings-backdrop" data-close-settings="true"></div>
      <div class="settings-content ui-card">
        <div class="settings-head">
          <h3 id="settingsTitle">Settings</h3>
          <button id="closeSettingsBtn" class="ghost-btn" type="button">Close</button>
        </div>

        <label class="toggle-row" for="autosaveToggle">
          <span>Autosave</span>
          <input id="autosaveToggle" type="checkbox" />
        </label>

        <label class="toggle-row" for="numberFormatSelect">
          <span>Number Format</span>
          <select id="numberFormatSelect">
            <option value="short">Short</option>
            <option value="scientific">Scientific</option>
          </select>
        </label>

        <label class="toggle-row" for="soundToggle">
          <span>Sound (Stub)</span>
          <input id="soundToggle" type="checkbox" />
        </label>

        <label class="toggle-row" for="treeDebugToggle">
          <span>Tree Debug</span>
          <input id="treeDebugToggle" type="checkbox" />
        </label>

        <div class="ui-card">
          <h4>Save Management</h4>
          <label class="toggle-row" for="saveSlotSelect">
            <span>Save Slot</span>
            <select id="saveSlotSelect">
              <option value="1">Slot 1</option>
              <option value="2">Slot 2</option>
              <option value="3">Slot 3</option>
            </select>
          </label>
          <p id="saveSlotSummaryText">No save loaded.</p>
          <div class="input-row">
            <button id="saveNowBtn" type="button">Save Now</button>
            <button id="loadSlotBtn" type="button">Load Slot</button>
            <button id="exportSaveBtn" type="button">Export Save</button>
            <button id="showImportBtn" type="button">Import Save</button>
          </div>
          <div id="importSaveWrap" class="is-hidden">
            <textarea id="importSaveInput" rows="6" placeholder="Paste save JSON here"></textarea>
            <div class="input-row">
              <button id="confirmImportBtn" type="button">Confirm Import</button>
              <button id="cancelImportBtn" type="button">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

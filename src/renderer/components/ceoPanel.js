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
    </aside>
  `;
}

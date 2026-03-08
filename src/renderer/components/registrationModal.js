export function renderRegistrationModal() {
  return `
    <div id="registrationModal" class="settings-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="registrationTitle">
      <div class="settings-backdrop"></div>
      <div class="settings-content ui-card">
        <div class="settings-head">
          <h3 id="registrationTitle">Create Player Profile</h3>
        </div>
        <p>Enter a display name to start your company profile.</p>
        <label class="toggle-row" for="registrationDisplayNameInput">
          <span>Display Name</span>
          <input id="registrationDisplayNameInput" type="text" minlength="3" maxlength="16" placeholder="Banana CEO" />
        </label>
        <label class="toggle-row" for="registrationAvatarEmojiInput">
          <span>Avatar Emoji</span>
          <input id="registrationAvatarEmojiInput" type="text" maxlength="2" placeholder="🐵" />
        </label>
        <p id="registrationErrorText" class="form-hint is-hidden">Please enter a valid display name.</p>
        <button id="confirmRegistrationBtn" type="button">Start Playing</button>
      </div>
    </div>
  `;
}

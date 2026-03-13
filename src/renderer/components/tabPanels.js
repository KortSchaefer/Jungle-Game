export function renderTabPanels() {
  return `
    <section class="main-column">
      <nav class="top-nav" aria-label="Game sections">
        <button id="showMainViewBtn" class="ghost-btn" type="button" aria-expanded="true" aria-controls="mainView">Main</button>
        <button id="toggleUpgradesBtn" class="ghost-btn" type="button" aria-expanded="false" aria-controls="upgradesView">Upgrades</button>
        <button id="toggleCasinoBtn" class="ghost-btn" type="button" aria-expanded="false" aria-controls="casinoView">Casino</button>
      </nav>
      <section id="challengeHudStrip" class="ui-card challenge-hud-strip" aria-live="polite">
        <p id="challengeHudStatusText">Ascension Challenge: Inactive</p>
        <p id="challengeHudTimerText">Start a challenge from the Upgrades view.</p>
      </section>

      <section id="mainView" class="main-view" aria-hidden="false">
        <div class="core-panels">
          <section id="treesPanel" class="tab-panel core-panel is-active" aria-label="Trees and farms">
          <div class="ui-card">
            <h3>Banana Tree Harvest</h3>
            <div id="treeHarvestRoot" class="tree-harvest-root">
              <div class="tree-visual">
                <img id="treeTextureImg" class="tree-texture-img" alt="Banana tree" draggable="false" />
                <div id="treeSpawnRegion" class="tree-spawn-region" aria-label="Banana spawn region">
                  <div id="treeBananaLayer" class="tree-banana-layer"></div>
                  <div id="treeHarvestFxLayer" class="tree-harvest-fx-layer"></div>
                </div>
                <div class="tree-box-footer">
                  <button id="shakeTreeBtn" type="button" title="Collect all bananas currently on tree">Shake Tree</button>
                </div>
              </div>
            </div>

            <div class="compact-actions">
              <button id="buyTreeBtn" type="button" title="Tree cost scales with trees owned">Add Tree</button>
              <button id="hireWorkerBtn" type="button" title="Hire workers to auto-pick bananas">Hire Worker</button>
              <button id="quickSellBtn" type="button" title="Quick sell a small amount at market price">Quick Sell</button>
              <button id="toggleUpgradeTreeBtn" type="button" title="Upgrade your tree tier">Upgrade Tree</button>
            </div>

            <div class="compact-grid">
              <p id="treesText">Trees Owned: 0</p>
              <p id="workersText">Workers: 0</p>
            </div>

            <div id="treeUpgradePanel" class="ui-card is-hidden">
              <h4>Tree Upgrade</h4>
              <p id="currentTierText">Current Tier: -</p>
              <p id="nextTierText">Next Tier: -</p>
              <p id="tierUnlockCostText">Unlock cost: -</p>
              <button id="unlockTierBtn" type="button" title="Unlock next tree tier with cash">Unlock Next Tier</button>
              <div class="progress-line">
                <span id="questProgressLabel">Quest Progress</span>
                <div class="progress-wrap"><div id="questProgressFill" class="progress-fill"></div></div>
              </div>
              <div class="progress-line">
                <span id="questCashProgressLabel">Cash Requirement</span>
                <div class="progress-wrap"><div id="questCashProgressFill" class="progress-fill"></div></div>
              </div>
              <p id="questTitleText">Current quest: -</p>
              <p id="questRewardText">Reward: -</p>
            </div>

            <div id="treeDebugPanel" class="compact-grid is-hidden">
              <p id="treeDebugCountText">Bananas on tree: 0</p>
              <p id="treeDebugIntervalText">Spawn interval: 1.50s</p>
              <p id="treeDebugAccumulatorText">Spawn accumulator: 0.00s</p>
              <p id="treeDebugGoldenText">Golden chance: 0.00%</p>
            </div>
          </div>

          <div class="ui-card">
            <h3>Tree Harvest Upgrades</h3>
            <details id="treeHarvestUpgradesDetails" class="pip-shop-details">
              <summary>Upgrade List</summary>
              <div id="treeHarvestUpgradesList" class="buyers-list pip-upgrades-grid"></div>
            </details>
          </div>

          <div class="ui-card">
            <h3>Buildings</h3>
            <div class="compact-grid">
              <div class="building-row">
                <p id="packingShedText">Packing Shed Lv 0</p>
                <button id="buyPackingShedBtn" type="button">Buy Packing Shed</button>
              </div>
              <div class="building-row">
                <p id="fertilizerLabText">Fertilizer Lab Lv 0</p>
                <button id="buyFertilizerLabBtn" type="button">Buy Fertilizer Lab</button>
              </div>
              <div class="building-row">
                <p id="researchLabText">Research Lab Lv 0</p>
                <button id="buyResearchLabBtn" type="button">Buy Research Lab</button>
              </div>
              <div class="building-row">
                <p id="financeOfficeText">Finance Office Lv 0</p>
                <button id="buyFinanceOfficeBtn" type="button">Buy Finance Office</button>
              </div>
            </div>
          </div>

          <div class="ui-card">
            <h3>Automation</h3>
            <div class="compact-grid">
              <div class="building-row">
                <p id="orchardText">Orchards: 0</p>
                <button id="buyOrchardBtn" type="button" title="Unlock automation that picks bananas directly off the tree">Buy Orchard</button>
              </div>
            </div>
            <p id="orchardInfoText">Orchards are locked.</p>
            <label class="toggle-row" for="autoSellToggle">
              <span>Auto-Sell Excess</span>
              <input id="autoSellToggle" type="checkbox" />
            </label>
            <label class="toggle-row" for="autoSellThresholdInput">
              <span>Threshold</span>
              <input id="autoSellThresholdInput" type="number" min="0" step="1" value="200" />
            </label>
            <p id="autoSellInfoText">Auto-Sell converts bananas above threshold at a low price.</p>
          </div>

          <div class="ui-card">
            <h3>Production Breakdown</h3>
            <p id="treesPerSecText">Trees/sec: 0</p>
            <p id="workersPerSecText">Workers/sec: 0</p>
            <p id="bonusMultipliersText">Bonuses: Production 1.00x, Export 1.00x</p>
          </div>
          </section>

          <section id="exportPanel" class="tab-panel core-panel is-active" aria-label="Exporting">
            <div class="ui-card">
              <h3>Export Automation</h3>
              <p id="autoExportStatusText">Auto-Export locked.</p>
              <button id="autoExportBtn" type="button" title="Unlocks automatic max-size shipments when buyers are ready">
                Unlock Auto-Export
              </button>
            </div>

            <div class="ui-card">
              <h3>Shipping Lane</h3>
              <label class="toggle-row" for="shippingLaneSelect">
                <span>Lane</span>
                <select id="shippingLaneSelect"></select>
              </label>
              <p id="laneInfoText">Lane bonus and capacity will appear here.</p>
            </div>

            <div class="ui-card">
              <h3>Sell Instantly At Market</h3>
              <p id="marketPriceText">Market price: $0 per banana</p>
              <div class="input-row">
                <input id="marketSellAmount" type="number" min="1" step="1" value="10" />
                <button id="sellBtn" type="button" title="Quick fallback sale at base market price">Sell Now</button>
              </div>
            </div>

            <div class="ui-card">
              <h3>Buyers</h3>
              <div id="buyersList" class="buyers-list"></div>
            </div>

            <div class="ui-card">
              <h3>Contracts</h3>
              <div id="contractsList" class="buyers-list"></div>
            </div>
          </section>
        </div>
      </section>

      <section id="upgradesView" class="tab-panel upgrades-panel is-hidden" aria-hidden="true">
        <div class="ui-card">
          <h3>Primate Intelligence Prestige</h3>
          <p id="pipText">PIP: 0</p>
          <p id="pipSpentText">PIP Spent: 0</p>
          <p id="prestigeCountText">Prestige Resets: 0</p>
          <p id="prestigeBonusText">Permanent bonus: +0% production, +0% export price, +0% click yield</p>
          <p id="prestigeUnlockText">Unlock condition: Reach Quantum Banana Reactor tier or 1.00M total bananas earned.</p>
          <p id="prestigeGainText">Reset gain: +0 PIP</p>
          <button id="prestigeBtn" type="button" title="Reset run progress for permanent PIP bonuses">Reset for PIP</button>
        </div>

        <div class="ui-card">
          <h3>PIP Shop</h3>
          <p id="pipShopSummaryText">Spend PIP on permanent cross-run upgrades.</p>
          <details id="pipShopDetails" class="pip-shop-details">
            <summary>PIP Upgrades</summary>
            <div id="pipUpgradesList" class="upgrade-grid pip-upgrades-grid"></div>
          </details>
        </div>

        <div class="ui-card">
          <h3>Research</h3>
          <p id="researchPointsText">Research Points: 0</p>
          <p id="researchRateText">RP/sec: 0</p>
        </div>

        <div class="ui-card">
          <h3>Weird Science</h3>
          <p id="bananaMatterText">Banana Matter: 0</p>
          <p id="exoticPeelParticlesText">Exotic Peel Particles: 0</p>
          <p id="antimatterBananasText">Antimatter Bananas: 0</p>
          <p id="antimatterBoostText">Antimatter Export Boost: 1.00x</p>
          <div class="compact-grid">
            <div class="building-row">
              <p id="quantumReactorText">Quantum Reactor Lv 0</p>
              <button id="buyQuantumReactorBtn" type="button">Build Reactor</button>
            </div>
            <div class="building-row">
              <p id="colliderText">Collider Lv 0</p>
              <button id="buyColliderBtn" type="button">Build Collider</button>
            </div>
            <div class="building-row">
              <p id="containmentText">Containment Lv 0</p>
              <button id="buyContainmentBtn" type="button">Build Containment</button>
            </div>
          </div>
        </div>

        <div class="ui-card">
          <h3>Research Tree</h3>
          <div id="researchTreeGrid" class="research-tree-grid"></div>
        </div>

        <div class="ui-card">
          <h3>Node Details</h3>
          <p id="researchDetailName">Select a node</p>
          <p id="researchDetailDesc">Choose a research node to see details.</p>
          <p id="researchDetailReq">Requirements: -</p>
          <p id="researchDetailCost">Cost: -</p>
          <p id="researchDetailState">State: -</p>
          <button id="researchBuyBtn" type="button">Research</button>
        </div>

        <div class="ui-card">
          <h3>Achievements</h3>
          <details id="achievementsDetails" class="achievements-details">
            <summary>Achievement List (<span id="achievementSummaryText">0 / 40 unlocked</span>)</summary>
            <div id="achievementsList" class="upgrade-grid achievements-grid"></div>
          </details>
        </div>

        <div class="ui-card">
          <h3>Ascension Challenges</h3>
          <details id="ascensionDetails" class="achievements-details">
            <summary>Challenge Hub</summary>
            <p id="challengeRunSummaryText">No active challenge run.</p>
            <p id="challengeStartWarningText" class="field-label">Starting a challenge applies temporary constraints and snapshots this run.</p>
            <div id="challengeObjectivesTracker" class="buyers-list challenge-tracker-list"></div>
            <div class="compact-actions">
              <button id="challengeResumeBtn" type="button">Resume</button>
              <button id="challengeAbandonBtn" type="button">Abandon</button>
              <button id="challengeCompleteBtn" type="button">Complete</button>
              <button id="challengeFailBtn" type="button">Fail</button>
            </div>
            <div id="challengesList" class="buyers-list challenge-hub-list"></div>
          </details>
        </div>

        <div id="challengeResultModal" class="modal is-hidden" aria-hidden="true" data-close-challenge-result="true">
          <div class="modal-content ui-card">
            <h3>Challenge Result</h3>
            <p id="challengeResultSummaryText">No recent challenge result.</p>
            <div id="challengeResultObjectivesList" class="buyers-list"></div>
            <div class="compact-actions">
              <button id="closeChallengeResultBtn" type="button">Close</button>
            </div>
          </div>
        </div>
      </section>

      <section id="casinoView" class="tab-panel upgrades-panel is-hidden" aria-hidden="true">
        <div class="ui-card casino-shell">
          <div class="casino-header">
            <div>
              <h3>Monkey Casino</h3>
              <p id="casinoIntroText">High-risk entertainment funded by banana capital.</p>
            </div>
            <div class="casino-game-nav">
              <button id="casinoBlackjackGameBtn" type="button">Blackjack</button>
              <button id="casinoMississippiStudGameBtn" type="button">Mississippi Stud</button>
              <button id="casinoBaccaratGameBtn" type="button">Baccarat</button>
              <button type="button" disabled>More Games Soon</button>
            </div>
          </div>

          <div id="casinoLockedPanel" class="buyer-card">
            <p class="buyer-name">Casino Locked</p>
            <p>Buy the 20 PIP Card Shark License upgrade in the PIP Shop to unlock blackjack.</p>
          </div>

          <div id="blackjackTableCard" class="ui-card casino-card-table is-hidden">
            <div class="casino-table-head">
              <div>
                <h3>Blackjack Table</h3>
                <p id="blackjackStatusText">Place a bet to start a hand.</p>
              </div>
              <p id="blackjackStakeText">Stake: $0</p>
            </div>

            <div class="casino-table-layout">
              <div class="blackjack-main">
                <div class="blackjack-section">
                  <p class="buyer-name">Dealer</p>
                  <p id="blackjackDealerValueText">Total: -</p>
                  <div id="blackjackDealerHands" class="blackjack-hand-zone"></div>
                </div>

                <div class="blackjack-section">
                  <p class="buyer-name">Player</p>
                  <p id="blackjackPlayerValueText">Active Hand: -</p>
                  <div id="blackjackPlayerHands" class="blackjack-hand-zone"></div>
                </div>
              </div>

              <aside class="blackjack-side">
                <div class="buyer-card">
                  <p class="buyer-name">Betting</p>
                  <div class="blackjack-chip-controls">
                    <input id="blackjackBetInput" type="number" min="1" step="1" value="100" />
                    <button id="blackjackMaxBetBtn" type="button">Max</button>
                    <button id="blackjackDealBtn" type="button">Deal</button>
                  </div>
                  <p id="blackjackInsuranceText">Insurance: $0</p>
                </div>

                <div class="buyer-card">
                  <p class="buyer-name">Actions</p>
                  <div class="compact-grid">
                    <button id="blackjackHitBtn" type="button">Hit</button>
                    <button id="blackjackStandBtn" type="button">Stand</button>
                    <button id="blackjackDoubleBtn" type="button">Double</button>
                    <button id="blackjackSplitBtn" type="button">Split</button>
                    <button id="blackjackInsuranceBtn" type="button">Take Insurance</button>
                    <button id="blackjackDeclineInsuranceBtn" type="button">Decline Insurance</button>
                    <button id="blackjackSurrenderBtn" type="button">Surrender</button>
                    <button id="blackjackCancelBtn" type="button">Cancel Round</button>
                  </div>
                </div>
              </aside>
            </div>

            <details class="blackjack-stats-details">
              <summary>Player Stats</summary>
              <div id="blackjackStatsList" class="compact-grid blackjack-stats-grid"></div>
            </details>
          </div>

          <div id="mississippiStudTableCard" class="ui-card casino-card-table is-hidden">
            <div class="casino-table-head">
              <div>
                <h3>Mississippi Stud</h3>
                <p id="mississippiStudStatusText">Place an ante to start a hand.</p>
              </div>
              <p id="mississippiStudStakeText">Ante: $0</p>
            </div>

            <div class="casino-table-layout">
              <div class="blackjack-main">
                <div class="blackjack-section">
                  <p class="buyer-name">Player Cards</p>
                  <p id="mississippiStudHandText">Current Hand: -</p>
                  <div id="mississippiStudPlayerCards" class="blackjack-hand-zone"></div>
                </div>

                <div class="blackjack-section">
                  <p class="buyer-name">Community Cards</p>
                  <p id="mississippiStudCommunityText">Reveal order: 3rd, 4th, 5th street</p>
                  <div id="mississippiStudCommunityCards" class="blackjack-hand-zone"></div>
                </div>
              </div>

              <aside class="blackjack-side">
                <div class="buyer-card">
                  <p class="buyer-name">Ante</p>
                  <div class="blackjack-chip-controls">
                    <input id="mississippiStudAnteInput" type="number" min="1" step="1" value="10" />
                    <button id="mississippiStudDealBtn" type="button">Deal</button>
                  </div>
                  <p id="mississippiStudCommittedText">Committed: $0</p>
                </div>

                <div class="buyer-card">
                  <p class="buyer-name">Street Action</p>
                  <div class="compact-grid">
                    <button id="mississippiStudBet1xBtn" type="button">Bet 1x</button>
                    <button id="mississippiStudBet2xBtn" type="button">Bet 2x</button>
                    <button id="mississippiStudBet3xBtn" type="button">Bet 3x</button>
                    <button id="mississippiStudFoldBtn" type="button">Fold</button>
                    <button id="mississippiStudCancelBtn" type="button">Cancel Round</button>
                  </div>
                </div>
              </aside>
            </div>

            <details class="blackjack-stats-details">
              <summary>Stud Stats</summary>
              <div id="mississippiStudStatsList" class="compact-grid blackjack-stats-grid"></div>
            </details>

            <details class="blackjack-stats-details">
              <summary>Paytable</summary>
              <div id="mississippiStudPaytableList" class="compact-grid blackjack-stats-grid"></div>
            </details>
          </div>

          <div id="baccaratTableCard" class="ui-card casino-card-table is-hidden">
            <div class="casino-table-head">
              <div>
                <h3>Baccarat</h3>
                <p id="baccaratStatusText">Choose a side and place a wager.</p>
              </div>
              <p id="baccaratStakeText">Bet: $0</p>
            </div>

            <div class="casino-table-layout">
              <div class="blackjack-main">
                <div class="blackjack-section">
                  <p class="buyer-name">Player</p>
                  <p id="baccaratPlayerValueText">Player Total: -</p>
                  <div id="baccaratPlayerCards" class="blackjack-hand-zone"></div>
                </div>

                <div class="blackjack-section">
                  <p class="buyer-name">Banker</p>
                  <p id="baccaratBankerValueText">Banker Total: -</p>
                  <div id="baccaratBankerCards" class="blackjack-hand-zone"></div>
                </div>
              </div>

              <aside class="blackjack-side">
                <div class="buyer-card">
                  <p class="buyer-name">Wager</p>
                  <div class="blackjack-chip-controls">
                    <input id="baccaratBetInput" type="number" min="1" step="1" value="25" />
                    <button id="baccaratMaxBetBtn" type="button">Max</button>
                  </div>
                  <p id="baccaratResultText">Bet Player, Banker, or Tie.</p>
                </div>

                <div class="buyer-card">
                  <p class="buyer-name">Bets</p>
                  <div class="compact-grid">
                    <button id="baccaratBetPlayerBtn" type="button">Bet Player</button>
                    <button id="baccaratBetBankerBtn" type="button">Bet Banker</button>
                    <button id="baccaratBetTieBtn" type="button">Bet Tie</button>
                  </div>
                </div>
              </aside>
            </div>

            <details class="blackjack-stats-details">
              <summary>Baccarat Stats</summary>
              <div id="baccaratStatsList" class="compact-grid blackjack-stats-grid"></div>
            </details>

            <details class="blackjack-stats-details">
              <summary>Payouts</summary>
              <div id="baccaratPayoutsList" class="compact-grid blackjack-stats-grid"></div>
            </details>
          </div>
        </div>
      </section>
    </section>
  `;
}

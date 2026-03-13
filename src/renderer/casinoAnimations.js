function clearTimers(entry) {
  entry.timers.forEach((timer) => clearTimeout(timer));
  entry.timers = [];
}

function scheduleSteps(entry, steps, requestRender) {
  clearTimers(entry);
  entry.busy = true;
  const lastDelay = steps.length ? steps[steps.length - 1].delay : 0;
  steps.forEach(({ delay, run }) => {
    const timer = setTimeout(() => {
      run();
      requestRender();
    }, delay);
    entry.timers.push(timer);
  });
  const releaseTimer = setTimeout(() => {
    entry.busy = false;
    requestRender();
  }, lastDelay + 40);
  entry.timers.push(releaseTimer);
}

function createEntry() {
  return {
    timers: [],
    busy: false,
    lastSignature: "",
    lastRevealSignature: "",
    visibleDealerCount: null,
    visiblePlayerHandCounts: [],
    visibleStudPlayerCount: null,
    visibleStudCommunityFaceUpCount: null,
    visibleBaccaratPlayerCount: null,
    visibleBaccaratBankerCount: null,
    showBaccaratResult: true,
  };
}

export function createCasinoAnimationController(requestRender) {
  const blackjack = createEntry();
  const stud = createEntry();
  const baccarat = createEntry();

  const syncBlackjack = (status) => {
    const signature = `${status.lastPlayedAt}|${status.mainBet}|${status.playerHands.map((hand) => hand.cards.length).join(",")}|${status.dealerCards.length}`;
    if (
      status.mainBet > 0 &&
      status.playerHands.length === 1 &&
      status.playerHands[0]?.cards.length === 2 &&
      status.dealerCards.length === 2 &&
      blackjack.lastSignature !== signature
    ) {
      blackjack.lastSignature = signature;
      blackjack.visibleDealerCount = 0;
      blackjack.visiblePlayerHandCounts = [0];
      scheduleSteps(
        blackjack,
        [
          { delay: 0, run: () => { blackjack.visibleDealerCount = 1; } },
          { delay: 120, run: () => { blackjack.visiblePlayerHandCounts = [1]; } },
          { delay: 240, run: () => { blackjack.visibleDealerCount = 2; } },
          { delay: 360, run: () => { blackjack.visiblePlayerHandCounts = [2]; } },
        ],
        requestRender
      );
    }

    const revealSignature = `${status.tablePhase}|${status.dealerCards.map((card) => (card.faceUp ? "1" : "0")).join("")}|${status.dealerCards.length}`;
    if (
      blackjack.lastRevealSignature !== revealSignature &&
      status.dealerCards.length > 2 &&
      ["dealer_turn", "settled"].includes(status.tablePhase)
    ) {
      blackjack.lastRevealSignature = revealSignature;
      const currentVisible = blackjack.visibleDealerCount == null ? Math.min(2, status.dealerCards.length) : blackjack.visibleDealerCount;
      blackjack.visibleDealerCount = Math.min(currentVisible, 2);
      const steps = [];
      for (let index = blackjack.visibleDealerCount + 1; index <= status.dealerCards.length; index += 1) {
        steps.push({
          delay: (index - blackjack.visibleDealerCount - 1) * 150,
          run: () => {
            blackjack.visibleDealerCount = index;
          },
        });
      }
      if (steps.length) {
        scheduleSteps(blackjack, steps, requestRender);
      }
    }
  };

  const getVisibleBlackjackStatus = (status) => ({
    ...status,
    visibleDealerCount: (() => {
      const actual = Array.isArray(status.dealerCards) ? status.dealerCards.length : 0;
      if (blackjack.visibleDealerCount == null) {
        return actual;
      }
      return blackjack.busy ? blackjack.visibleDealerCount : Math.max(blackjack.visibleDealerCount, actual);
    })(),
    visiblePlayerHandCounts: (() => {
      const actual = Array.isArray(status.playerHands) ? status.playerHands.map((hand) => hand.cards.length) : [];
      if (!blackjack.visiblePlayerHandCounts.length) {
        return actual;
      }
      return actual.map((count, index) => {
        const visible = blackjack.visiblePlayerHandCounts[index] ?? 0;
        return blackjack.busy ? visible : Math.max(visible, count);
      });
    })(),
    animationBusy: blackjack.busy,
  });

  const syncStud = (status) => {
    const signature = `${status.lastPlayedAt}|${status.anteBet}|${status.playerCards.length}|${status.communityCards.length}`;
    if (status.anteBet > 0 && status.playerCards.length === 2 && stud.lastSignature !== signature) {
      stud.lastSignature = signature;
      stud.visibleStudPlayerCount = 0;
      stud.visibleStudCommunityFaceUpCount = 0;
      scheduleSteps(
        stud,
        [
          { delay: 0, run: () => { stud.visibleStudPlayerCount = 1; } },
          { delay: 140, run: () => { stud.visibleStudPlayerCount = 2; } },
        ],
        requestRender
      );
    }
    const revealedCount = (status.communityCards || []).filter((card) => card.faceUp).length;
    const revealSignature = `${status.tablePhase}|${revealedCount}|${status.currentDecisionIndex}`;
    if (stud.lastRevealSignature !== revealSignature && revealedCount > (stud.visibleStudCommunityFaceUpCount ?? 0)) {
      stud.lastRevealSignature = revealSignature;
      const nextCount = revealedCount;
      scheduleSteps(
        stud,
        [
          {
            delay: 200,
            run: () => {
              stud.visibleStudCommunityFaceUpCount = nextCount;
            },
          },
        ],
        requestRender
      );
    }
  };

  const getVisibleStudStatus = (status) => {
    const visiblePlayerCount = stud.visibleStudPlayerCount == null ? status.playerCards.length : stud.visibleStudPlayerCount;
    const visibleFaceUp = stud.visibleStudCommunityFaceUpCount == null
      ? (status.communityCards || []).filter((card) => card.faceUp).length
      : stud.visibleStudCommunityFaceUpCount;
    return {
      ...status,
      visiblePlayerCount: stud.busy ? visiblePlayerCount : Math.max(visiblePlayerCount, Array.isArray(status.playerCards) ? status.playerCards.length : 0),
      visibleCommunityFaceUpCount: stud.busy
        ? visibleFaceUp
        : Math.max(visibleFaceUp, (status.communityCards || []).filter((card) => card.faceUp).length),
      animationBusy: stud.busy,
    };
  };

  const syncBaccarat = (status) => {
    const signature = `${status.lastPlayedAt}|${status.betAmount}|${status.result}|${status.playerCards.length}|${status.bankerCards.length}|${status.playerTotal}|${status.bankerTotal}|${status.betChoice}`;
    if (status.betAmount > 0 && status.result && baccarat.lastSignature !== signature) {
      baccarat.lastSignature = signature;
      baccarat.visibleBaccaratPlayerCount = 0;
      baccarat.visibleBaccaratBankerCount = 0;
      baccarat.showBaccaratResult = false;
      const steps = [
        { delay: 0, run: () => { baccarat.visibleBaccaratPlayerCount = 1; } },
        { delay: 120, run: () => { baccarat.visibleBaccaratBankerCount = 1; } },
        { delay: 240, run: () => { baccarat.visibleBaccaratPlayerCount = Math.min(2, status.playerCards.length); } },
        { delay: 360, run: () => { baccarat.visibleBaccaratBankerCount = Math.min(2, status.bankerCards.length); } },
      ];
      if (status.playerCards.length > 2) {
        steps.push({ delay: 520, run: () => { baccarat.visibleBaccaratPlayerCount = status.playerCards.length; } });
      }
      if (status.bankerCards.length > 2) {
        steps.push({ delay: status.playerCards.length > 2 ? 680 : 520, run: () => { baccarat.visibleBaccaratBankerCount = status.bankerCards.length; } });
      }
      steps.push({
        delay: (steps[steps.length - 1]?.delay || 360) + 220,
        run: () => {
          baccarat.showBaccaratResult = true;
        },
      });
      scheduleSteps(baccarat, steps, requestRender);
    }
  };

  const getVisibleBaccaratStatus = (status) => ({
    ...status,
    visiblePlayerCount: (() => {
      const actual = Array.isArray(status.playerCards) ? status.playerCards.length : 0;
      if (baccarat.visibleBaccaratPlayerCount == null) {
        return actual;
      }
      return baccarat.busy ? baccarat.visibleBaccaratPlayerCount : Math.max(baccarat.visibleBaccaratPlayerCount, actual);
    })(),
    visibleBankerCount: (() => {
      const actual = Array.isArray(status.bankerCards) ? status.bankerCards.length : 0;
      if (baccarat.visibleBaccaratBankerCount == null) {
        return actual;
      }
      return baccarat.busy ? baccarat.visibleBaccaratBankerCount : Math.max(baccarat.visibleBaccaratBankerCount, actual);
    })(),
    showResult: baccarat.showBaccaratResult,
    animationBusy: baccarat.busy,
  });

  return {
    syncBlackjack,
    syncStud,
    syncBaccarat,
    getVisibleBlackjackStatus,
    getVisibleStudStatus,
    getVisibleBaccaratStatus,
    isBusy(gameId) {
      if (gameId === "blackjack") {
        return blackjack.busy;
      }
      if (gameId === "mississippi_stud") {
        return stud.busy;
      }
      if (gameId === "baccarat") {
        return baccarat.busy;
      }
      return false;
    },
  };
}

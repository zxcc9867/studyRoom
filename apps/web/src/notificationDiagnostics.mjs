const legacyChannels = new Set(["telegram", "kakao_memo"]);

const text = {
  lastDeliveryLabel: "\ucd5c\uadfc \ubc1c\uc1a1",
  sent: "\uc131\uacf5",
  failed: "\uc2e4\ud328",
  noDeliveries: "\ucd5c\uadfc \ubc1c\uc1a1 \uae30\ub85d \uc5c6\uc74c",
  noDeliveriesDetail: "\uc544\uc9c1 \uc774 \uacc4\uc815\uc73c\ub85c \uae30\ub85d\ub41c \uc54c\ub9bc \ubc1c\uc1a1\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
  legacyLabel: "\ub808\uac70\uc2dc \ucc44\ub110",
  legacySummary: "Slack \uae30\uc900\uc73c\ub85c \uc6b4\uc6a9 \uc911",
  legacyDetail: "Telegram \ub4f1 \ub808\uac70\uc2dc \ucc44\ub110\uc740 \uacfc\uac70 \uae30\ub85d \ubcf4\uc874\uc6a9\uc785\ub2c8\ub2e4. \uc0c8 \uc54c\ub9bc\uc740 Slack\uacfc \ube0c\ub77c\uc6b0\uc800 \uc54c\ub9bc\uc744 \uae30\uc900\uc73c\ub85c \ud655\uc778\ud558\uc138\uc694.",
  browserLabel: "\ucef4\ud4e8\ud130 \uc54c\ub9bc",
  checking: "\ud655\uc778 \uc911",
  checkingBrowserDetail: "\ube0c\ub77c\uc6b0\uc800 \uc54c\ub9bc \uad8c\ud55c\uacfc \ud478\uc2dc \uad6c\ub3c5 \uc0c1\ud0dc\ub97c \ud655\uc778\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.",
  unsupported: "\ubbf8\uc9c0\uc6d0",
  unsupportedDetail: "\uc774 \ube0c\ub77c\uc6b0\uc800\ub294 Web Push\ub97c \uc9c0\uc6d0\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.",
  denied: "\ube0c\ub77c\uc6b0\uc800\uc5d0\uc11c \ucc28\ub2e8\ub428",
  deniedDetail: "\ube0c\ub77c\uc6b0\uc800 \uc0ac\uc774\ud2b8 \uc124\uc815\uc5d0\uc11c \uc54c\ub9bc \uad8c\ud55c\uc744 \ud5c8\uc6a9\ud574\uc57c \ud569\ub2c8\ub2e4.",
  permissionNeeded: "\uad8c\ud55c \ud544\uc694",
  permissionNeededDetail: "\uc800\uc7a5\ud558\uace0 \ucef4\ud4e8\ud130 \uc54c\ub9bc \ucf1c\uae30 \ubc84\ud2bc\uc73c\ub85c \uad8c\ud55c\uc744 \ud5c8\uc6a9\ud558\uc138\uc694.",
  noSubscription: "\ud478\uc2dc \uad6c\ub3c5 \uc5c6\uc74c",
  noSubscriptionDetail: "\uad8c\ud55c\uc740 \ud5c8\uc6a9\ub410\uc9c0\ub9cc \uc774 \ube0c\ub77c\uc6b0\uc800\uc758 \ud478\uc2dc \uad6c\ub3c5\uc774 \uc544\uc9c1 \uc5c6\uc2b5\ub2c8\ub2e4.",
  registered: "\ub4f1\ub85d\ub428",
  registeredBrowserDetail: "\uc774 \ube0c\ub77c\uc6b0\uc800\ub294 \ucef4\ud4e8\ud130 \uc54c\ub9bc\uc744 \ubc1b\uc744 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
  slackCheckingDetail: "\uc800\uc7a5\ub41c Slack Channel ID\ub97c \ud655\uc778\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.",
  slackMissing: "\ucc44\ub110 \ubbf8\ub4f1\ub85d",
  slackMissingDetail: "Slack Channel ID\ub97c \uc800\uc7a5\ud574\uc57c \uc11c\ubc84 \uc54c\ub9bc\uacfc \ud14c\uc2a4\ud2b8 \uc54c\ub9bc\uc744 \ubc1b\uc744 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
  saved: "\uc800\uc7a5\ub428",
  noRecord: "\uae30\ub85d \uc5c6\uc74c",
};

export function normalizeNotificationDeliveries(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      channel: typeof row.channel === "string" ? row.channel : "unknown",
      status: row.status === "sent" ? "sent" : "failed",
      errorMessage: typeof row.error_message === "string" ? row.error_message : "",
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
      legacy: legacyChannels.has(row.channel),
    }));
}

export function buildNotificationDiagnostics({ webPushStatus, slackStatus, deliveries }) {
  const latestDelivery = deliveries[0] ?? null;

  return [
    buildBrowserDiagnostic(webPushStatus),
    buildSlackDiagnostic(slackStatus),
    {
      id: "last-delivery",
      label: text.lastDeliveryLabel,
      state: latestDelivery ? (latestDelivery.status === "sent" ? "ready" : "blocked") : "info",
      summary: latestDelivery
        ? `${latestDelivery.channel} ${latestDelivery.status === "sent" ? text.sent : text.failed}`
        : text.noDeliveries,
      detail: latestDelivery
        ? `${latestDelivery.channel} - ${formatDiagnosticTime(latestDelivery.createdAt)}${latestDelivery.errorMessage ? ` - ${latestDelivery.errorMessage}` : ""}`
        : text.noDeliveriesDetail,
    },
    {
      id: "legacy",
      label: text.legacyLabel,
      state: "info",
      summary: text.legacySummary,
      detail: text.legacyDetail,
    },
  ];
}

function buildBrowserDiagnostic(status) {
  if (!status) {
    return {
      id: "browser",
      label: text.browserLabel,
      state: "checking",
      summary: text.checking,
      detail: text.checkingBrowserDetail,
    };
  }
  if (!status.supported) {
    return {
      id: "browser",
      label: text.browserLabel,
      state: "blocked",
      summary: text.unsupported,
      detail: text.unsupportedDetail,
    };
  }
  if (status.permission === "denied") {
    return {
      id: "browser",
      label: text.browserLabel,
      state: "blocked",
      summary: text.denied,
      detail: text.deniedDetail,
    };
  }
  if (status.permission !== "granted") {
    return {
      id: "browser",
      label: text.browserLabel,
      state: "needed",
      summary: text.permissionNeeded,
      detail: text.permissionNeededDetail,
    };
  }
  if (!status.subscribed) {
    return {
      id: "browser",
      label: text.browserLabel,
      state: "needed",
      summary: text.noSubscription,
      detail: text.noSubscriptionDetail,
    };
  }
  return {
    id: "browser",
    label: text.browserLabel,
    state: "ready",
    summary: text.registered,
    detail: text.registeredBrowserDetail,
  };
}

function buildSlackDiagnostic(status) {
  if (!status) {
    return {
      id: "slack",
      label: "Slack",
      state: "checking",
      summary: text.checking,
      detail: text.slackCheckingDetail,
    };
  }
  if (!status.connected) {
    return {
      id: "slack",
      label: "Slack",
      state: "needed",
      summary: text.slackMissing,
      detail: text.slackMissingDetail,
    };
  }
  return {
    id: "slack",
    label: "Slack",
    state: "ready",
    summary: status.channelId,
    detail: `${text.saved}${status.updatedAt ? ` - ${formatDiagnosticTime(status.updatedAt)}` : ""}`,
  };
}

export function formatDiagnosticTime(value) {
  if (!value) return text.noRecord;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text.noRecord;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

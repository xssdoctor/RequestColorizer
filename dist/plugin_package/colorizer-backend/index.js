// packages/backend/src/index.ts
async function init(sdk) {
  try {
    const db = await sdk.meta.db();
    await db.exec(`
      CREATE TABLE IF NOT EXISTS highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        host TEXT NOT NULL,
        path TEXT NOT NULL,
        colour TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_highlights_method ON highlights(method);
      CREATE INDEX IF NOT EXISTS idx_highlights_host ON highlights(host);
      CREATE INDEX IF NOT EXISTS idx_highlights_path ON highlights(path);
    `);
    let highlightRules = [];
    const reloadHighlightRules = async () => {
      try {
        const stmt = await db.prepare(
          "SELECT method, host, path, colour FROM highlights"
        );
        highlightRules = await stmt.all();
      } catch (error) {
        highlightRules = [];
      }
    };
    await reloadHighlightRules();
    sdk.events.onInterceptRequest(async (_sdk, request) => {
      try {
        const method = request.getMethod();
        const host = request.getHost();
        const path = request.getPath();
        for (const rule of highlightRules) {
          const methodMatches = method.includes(rule.method);
          const hostMatches = host.includes(rule.host);
          const pathMatches = path.includes(rule.path);
          if (methodMatches && hostMatches && pathMatches) {
            sdk.api.send("requests-matched", [
              {
                id: request.getId(),
                colour: rule.colour,
                findingId: "auto-color"
              }
            ]);
            break;
          }
        }
      } catch (error) {
      }
    });
    sdk.api.register(
      "addHighlightRule",
      async (_sdk, requestId, method, host, path, colour) => {
        try {
          const stmt = await db.prepare(
            "INSERT INTO highlights(method, host, path, colour) VALUES(?, ?, ?, ?)"
          );
          await stmt.run(method, host, path, colour);
          await reloadHighlightRules();
          sdk.api.send("requests-matched", [
            {
              id: requestId,
              colour,
              findingId: "rule-added"
            }
          ]);
          const httpqlFilter = `req.method.cont:"${method}" AND req.host.cont:"${host}" AND req.path.cont:"${path}"`;
          await processMatchingRequestsInBatches(
            _sdk,
            httpqlFilter,
            colour,
            requestId,
            sdk
          );
        } catch (error) {
          throw error;
        }
      }
    );
  } catch (error) {
  }
}
async function processMatchingRequestsInBatches(_sdk, httpqlFilter, colour, originalRequestId, sdk) {
  const BATCH_SIZE = 1e3;
  const COLORIZE_BATCH_SIZE = 50;
  let cursor = void 0;
  let totalProcessed = 0;
  let colorizeQueue = [];
  try {
    do {
      let query = _sdk.requests.query().filter(httpqlFilter).first(BATCH_SIZE);
      if (cursor) {
        query = query.after(cursor);
      }
      const connection = await query.execute();
      if (!connection.items || connection.items.length === 0) {
        break;
      }
      for (const item of connection.items) {
        const candidateRequest = item.request;
        if (candidateRequest.getId() === originalRequestId) {
          continue;
        }
        colorizeQueue.push({
          id: candidateRequest.getId(),
          colour,
          findingId: "retroactive-match"
        });
        if (colorizeQueue.length >= COLORIZE_BATCH_SIZE) {
          sdk.api.send("requests-matched", [...colorizeQueue]);
          colorizeQueue = [];
        }
        totalProcessed++;
      }
      if (connection.pageInfo && connection.pageInfo.hasNextPage && connection.pageInfo.endCursor) {
        cursor = connection.pageInfo.endCursor;
      } else {
        cursor = void 0;
      }
    } while (cursor);
    if (colorizeQueue.length > 0) {
      sdk.api.send("requests-matched", [...colorizeQueue]);
    }
  } catch (error) {
    if (colorizeQueue.length > 0) {
      sdk.api.send("requests-matched", [...colorizeQueue]);
    }
  }
}
export {
  init
};

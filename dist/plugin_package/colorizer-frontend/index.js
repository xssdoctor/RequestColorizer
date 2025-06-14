const s = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Grey"
], l = /* @__PURE__ */ new Map();
async function u(e, r, t) {
  try {
    const a = {
      Red: "RED",
      Orange: "ORANGE",
      Yellow: "YELLOW",
      Green: "GREEN",
      Blue: "BLUE",
      Purple: "PURPLE",
      Grey: "GREY"
    }[String(t).trim()] || "YELLOW";
    if (e.graphql && typeof e.graphql.updateRequestMetadata == "function")
      try {
        const n = {
          id: r,
          input: {
            color: a
          }
        }, i = await e.graphql.updateRequestMetadata(n);
        if (i && !i.errors)
          return !0;
      } catch {
      }
    return !1;
  } catch {
    return !1;
  }
}
async function c(e, r, t) {
  try {
    return l.set(e, r), t ? await u(t, e, r) : !1;
  } catch {
    return !1;
  }
}
async function p(e) {
  try {
    e.commands.register("colorize.similar", {
      name: "Color similar requests…",
      async run(r) {
        var t;
        try {
          const o = r.request ?? ((t = r.requests) == null ? void 0 : t[0]);
          if (!(o != null && o.id))
            return;
          const a = await d();
          if (!a) return;
          await e.backend.addHighlightRule(o.id, a), await c(o.id, a, e);
        } catch {
        }
      }
    }), e.menu.registerItem({
      type: "Request",
      commandId: "colorize.similar",
      leadingIcon: "fas fa-palette"
    }), e.menu.registerItem({
      type: "RequestRow",
      commandId: "colorize.similar",
      leadingIcon: "fas fa-palette"
    }), e.backend.onEvent(
      "request-matched",
      async (r, t, o) => {
        try {
          await c(r, t, e);
        } catch {
        }
      }
    );
  } catch {
  }
}
async function d() {
  return new Promise((e) => {
    try {
      const r = document.createElement("dialog");
      r.innerHTML = `
        <style>
          dialog { padding:1.5rem; border:none; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); }
          button { margin:.25rem; padding:.75rem 1rem; border:none; border-radius:6px; cursor:pointer; font-size:.9em; }
        </style>
        <h3>Choose a color</h3>
        ${s.map(
        (t) => `<button data-c="${t}" style="background:${t.toLowerCase()};color:white">${t}</button>`
      ).join("")}
        <button data-c="">Cancel</button>
      `, r.addEventListener("click", (t) => {
        const o = t.target.closest("button");
        r.close(), e((o == null ? void 0 : o.dataset.c) || void 0);
      }), document.body.append(r), r.showModal();
    } catch {
      e(void 0);
    }
  });
}
export {
  p as init
};

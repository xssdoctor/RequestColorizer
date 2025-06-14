const l = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Grey"
], s = /* @__PURE__ */ new Map();
async function u(r, e, t) {
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
    if (r.graphql && typeof r.graphql.updateRequestMetadata == "function")
      try {
        const n = {
          id: e,
          input: {
            color: a
          }
        }, i = await r.graphql.updateRequestMetadata(n);
        if (i && !i.errors)
          return !0;
      } catch {
      }
    return !1;
  } catch {
    return !1;
  }
}
async function c(r, e, t) {
  try {
    return s.set(r, e), t ? await u(t, r, e) : !1;
  } catch {
    return !1;
  }
}
async function p(r) {
  try {
    r.commands.register("colorize.similar", {
      name: "Color similar requests…",
      async run(e) {
        var t;
        try {
          const o = e.request ?? ((t = e.requests) == null ? void 0 : t[0]);
          if (!(o != null && o.id))
            return;
          const a = await d();
          if (!a) return;
          await r.backend.addHighlightRule(o.id, a), await c(o.id, a, r);
        } catch {
        }
      }
    }), r.menu.registerItem({
      type: "Request",
      commandId: "colorize.similar",
      leadingIcon: "fas fa-palette"
    }), r.menu.registerItem({
      type: "RequestRow",
      commandId: "colorize.similar",
      leadingIcon: "fas fa-palette"
    }), r.backend.onEvent(
      "request-matched",
      async (e, t, o) => {
        try {
          await c(e, t, r);
        } catch {
        }
      }
    );
  } catch {
  }
}
async function d() {
  return new Promise((r) => {
    try {
      const e = document.createElement("dialog");
      e.className = "colorizer-plugin", e.innerHTML = `
        <style>
          .colorizer-plugin dialog { 
            padding:1.5rem; 
            border:none; 
            border-radius:8px; 
            box-shadow:0 4px 12px rgba(0,0,0,0.15); 
            background: white;
            color: black;
          }
          .colorizer-plugin button { 
            margin:.25rem; 
            padding:.75rem 1rem; 
            border:none; 
            border-radius:6px; 
            cursor:pointer; 
            font-size:.9em; 
          }
          .colorizer-plugin h3 {
            margin-top: 0;
            margin-bottom: 1rem;
            font-size: 1.1em;
            font-weight: 600;
          }
        </style>
        <h3>Choose a color</h3>
        ${l.map(
        (t) => `<button data-c="${t}" style="background:${t.toLowerCase()};color:white">${t}</button>`
      ).join("")}
        <button data-c="" style="background:#6b7280;color:white">Cancel</button>
      `, e.addEventListener("click", (t) => {
        const o = t.target.closest("button");
        e.close(), r((o == null ? void 0 : o.dataset.c) || void 0);
      }), document.body.append(e), e.showModal();
    } catch {
      r(void 0);
    }
  });
}
export {
  p as init
};

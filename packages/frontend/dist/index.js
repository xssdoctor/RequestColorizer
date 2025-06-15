const l = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Grey"
], s = /* @__PURE__ */ new Map();
async function u(e, t, o) {
  try {
    const n = {
      Red: "RED",
      Orange: "ORANGE",
      Yellow: "YELLOW",
      Green: "GREEN",
      Blue: "BLUE",
      Purple: "PURPLE",
      Grey: "GREY"
    }[String(o).trim()] || "YELLOW";
    if (e.graphql && typeof e.graphql.updateRequestMetadata == "function")
      try {
        const i = {
          id: t,
          input: {
            color: n
          }
        }, a = await e.graphql.updateRequestMetadata(i);
        if (a && !a.errors)
          return !0;
      } catch {
      }
    return !1;
  } catch {
    return !1;
  }
}
async function c(e, t, o) {
  try {
    return s.set(e, t), o ? await u(o, e, t) : !1;
  } catch {
    return !1;
  }
}
async function d(e, t) {
  if (!t || !e.length) return;
  const o = 10;
  for (let r = 0; r < e.length; r += o) {
    const i = e.slice(r, r + o).map(
      (a) => c(a.id, a.colour, t)
    );
    try {
      await Promise.all(i);
    } catch {
    }
    r + o < e.length && await new Promise((a) => setTimeout(a, 10));
  }
}
async function m(e) {
  try {
    e.commands.register("colorize.similar", {
      name: "Color similar requests…",
      async run(t) {
        var o;
        try {
          const r = t.request ?? ((o = t.requests) == null ? void 0 : o[0]);
          if (!(r != null && r.id))
            return;
          const n = await p();
          if (!n) return;
          await e.backend.addHighlightRule(
            r.id,
            r.method,
            r.host,
            r.path,
            n
          ), await c(r.id, n, e);
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
      "requests-matched",
      async (t) => {
        try {
          await d(t, e);
        } catch {
        }
      }
    );
  } catch {
  }
}
async function p() {
  return new Promise((e) => {
    try {
      const t = document.createElement("dialog");
      t.className = "colorizer-plugin", t.innerHTML = `
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
        (o) => `<button data-c="${o}" style="background:${o.toLowerCase()};color:white">${o}</button>`
      ).join("")}
        <button data-c="" style="background:#6b7280;color:white">Cancel</button>
      `, t.addEventListener("click", (o) => {
        const r = o.target.closest("button");
        t.close(), e((r == null ? void 0 : r.dataset.c) || void 0);
      }), document.body.append(t), t.showModal();
    } catch {
      e(void 0);
    }
  });
}
export {
  m as init
};

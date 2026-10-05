/* ═══════════════════════════════════════════════════════════════
   Riddhi Siddhi Fabricator — Unified Navigation System (Phase 1)
   Provides:
   - Unified desktop navigation (Home, uPVC & Windows, Aluminium,
     Steel & Gates, Projects Portfolio, About, Contact)
   - Accessible mobile navigation drawer (< 992px)
   - Thumb-friendly mobile quick-contact bar (Call + WhatsApp)
   - Keyboard focus trap, ESC key close, aria attributes
   ═══════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── Business Constants ── */
  var PHONE = "9771086644";
  var PHONE_TEL = "tel:9771086644";
  var WHATSAPP_URL = "https://wa.me/919771086644";
  var BREAKPOINT = 992; /* px: 992px and below uses mobile drawer */

  /* ── Active link detection ── */
  var loc = window.location;
  var rawPath = loc.pathname.replace(/\/+$/, "").replace(/\.html$/, "");
  var search = loc.search || "";
  var categoryParam = (new URLSearchParams(search)).get("category") || "";

  function isActive(href) {
    if (!href) return false;
    var targetUrl = href.toLowerCase();

    /* Match category tabs on projects.html */
    if (targetUrl.indexOf("category=") !== -1) {
      var targetCat = targetUrl.split("category=")[1].split("&")[0];
      if ((rawPath.indexOf("projects") !== -1 || rawPath.indexOf("project") !== -1) && categoryParam.toLowerCase() === targetCat) {
        return true;
      }
      return false;
    }

    /* Match home page */
    if (targetUrl === "index.html" || targetUrl === "/" || targetUrl === "") {
      if ((rawPath === "" || rawPath === "/" || rawPath.endsWith("index")) && !categoryParam) {
        return true;
      }
      return false;
    }

    /* Match about / contact */
    if (targetUrl.indexOf("#about") !== -1 && (rawPath === "/about" || loc.hash === "#about")) return true;
    if (targetUrl.indexOf("#contact") !== -1 && (rawPath === "/contact" || loc.hash === "#contact")) return true;

    return false;
  }

  /* ── Unified Navigation Links ── */
  var NAV_LINKS = [
    { label: "Home", href: "index.html" },
    { label: "uPVC & Windows", href: "projects.html?category=upvc" },
    { label: "Aluminium", href: "projects.html?category=aluminium" },
    { label: "Steel & Gates", href: "projects.html?category=steel" },
    { label: "Projects Portfolio", href: "projects.html?category=featured" },
    { label: "About", href: "index.html#about" },
    { label: "Contact", href: "index.html#contact" }
  ];

  /* ── SVG Icons ── */
  var ICON_PHONE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var ICON_WA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var ICON_ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
  var ICON_HAMBURGER = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
  var ICON_CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  /* ── Inject Unified CSS ── */
  var style = document.createElement("style");
  style.id = "rs-unified-nav-styles";
  style.textContent = [
    /* Desktop mainnav base */
    "#mainnav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; padding: 14px clamp(16px, 3vw, 48px); background: rgba(14, 7, 9, 0.88); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(185, 168, 172, 0.08); transition: background 0.35s ease; }",
    "#mainnav .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }",
    "#mainnav .nav-logo img { height: 32px; width: auto; filter: brightness(1.3); }",
    "#mainnav .nav-logo span { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #B9A8AC; font-weight: 500; }",

    /* Desktop links */
    "#mainnav .nav-links { display: flex; align-items: center; gap: clamp(10px, 1.35vw, 22px); margin: 0 16px; }",
    "#mainnav .nav-links a { color: rgba(245, 240, 232, 0.6); text-decoration: none; font-size: clamp(10.5px, 0.82vw, 11.5px); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; transition: color 0.25s; white-space: nowrap; padding: 6px 2px; }",
    "#mainnav .nav-links a:hover { color: #F5F0E8; }",
    "#mainnav .nav-links a.rs-active { color: #F5F0E8; border-bottom: 2px solid #7A4F5E; }",

    /* Desktop right actions */
    "#mainnav .nav-right { display: flex; align-items: center; gap: clamp(10px, 1.2vw, 16px); flex-shrink: 0; }",
    "#mainnav .nav-phone { color: #B9A8AC; text-decoration: none; font-size: 11.5px; font-weight: 500; display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 8px; transition: color 0.25s, background 0.25s; white-space: nowrap; }",
    "#mainnav .nav-phone:hover { color: #F5F0E8; background: rgba(185, 168, 172, 0.08); }",
    "#mainnav .nav-phone span { display: inline; }",
    "#mainnav .nav-cta-btn { padding: 8px 20px; border-radius: 100px; background: #53313B; color: #FCEEEF; text-decoration: none; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; border: 1px solid rgba(185, 168, 172, 0.15); transition: all 0.3s; white-space: nowrap; }",
    "#mainnav .nav-cta-btn:hover { background: #6B4350; box-shadow: 0 6px 24px rgba(83, 49, 59, 0.4); transform: translateY(-1px); }",

    /* Hamburger button */
    ".rs-hamburger { display: none; background: none; border: none; color: #B9A8AC; cursor: pointer; padding: 0; margin: 0; width: 44px; height: 44px; min-width: 44px; min-height: 44px; align-items: center; justify-content: center; border-radius: 8px; flex-shrink: 0; transition: color 0.2s, background 0.2s; -webkit-tap-highlight-color: transparent; box-sizing: border-box; }",
    ".rs-hamburger:hover { color: #F5F0E8; background: rgba(185, 168, 172, 0.08); }",
    ".rs-hamburger:focus-visible { outline: 2px solid #7A4F5E; outline-offset: 2px; }",

    /* Drawer overlay */
    ".rs-drawer-overlay { display: none; position: fixed; inset: 0; z-index: 98; background: rgba(10, 5, 7, 0.65); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); opacity: 0; transition: opacity 0.3s ease; }",
    ".rs-drawer-overlay.open { display: block; opacity: 1; }",

    /* Drawer panel */
    ".rs-drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 99; width: min(320px, 86vw); background: rgba(14, 7, 9, 0.97); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border-left: 1px solid rgba(185, 168, 172, 0.12); transform: translateX(100%); transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1); display: flex; flex-direction: column; overflow-y: auto; -webkit-overflow-scrolling: touch; box-shadow: -10px 0 36px rgba(0, 0, 0, 0.6); }",
    ".rs-drawer.open { transform: translateX(0); }",

    /* Drawer header */
    ".rs-drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid rgba(185, 168, 172, 0.08); flex-shrink: 0; }",
    ".rs-drawer-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }",
    ".rs-drawer-brand img { height: 28px; width: auto; filter: brightness(1.3); }",
    ".rs-drawer-brand span { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #B9A8AC; font-weight: 500; }",
    ".rs-drawer-close { background: none; border: none; color: #B9A8AC; cursor: pointer; padding: 10px; margin: -10px -8px -10px 0; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: color 0.2s, background 0.2s; -webkit-tap-highlight-color: transparent; }",
    ".rs-drawer-close:hover { color: #F5F0E8; background: rgba(185, 168, 172, 0.08); }",
    ".rs-drawer-close:focus-visible { outline: 2px solid #7A4F5E; outline-offset: 2px; }",

    /* Drawer nav list */
    ".rs-drawer-nav { list-style: none; margin: 0; padding: 14px 0; flex: 1; }",
    ".rs-drawer-nav li { margin: 0; }",
    ".rs-drawer-nav a { display: flex; align-items: center; padding: 13px 24px; color: rgba(245, 240, 232, 0.65); text-decoration: none; font-size: 14px; letter-spacing: 0.04em; font-weight: 500; transition: color 0.2s, background 0.2s; min-height: 44px; }",
    ".rs-drawer-nav a:hover, .rs-drawer-nav a:focus { color: #F5F0E8; background: rgba(83, 49, 59, 0.2); }",
    ".rs-drawer-nav a.rs-active { color: #FCEEEF; background: rgba(83, 49, 59, 0.35); border-left: 3px solid #7A4F5E; padding-left: 21px; }",
    ".rs-drawer-nav a:focus-visible { outline: 2px solid #7A4F5E; outline-offset: -2px; }",

    /* Drawer actions (Call / WhatsApp / Quote) */
    ".rs-drawer-actions { padding: 16px 20px 24px; border-top: 1px solid rgba(185, 168, 172, 0.08); flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }",
    ".rs-drawer-actions .rs-act-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 18px; border-radius: 100px; font-size: 12.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none; transition: all 0.25s; min-height: 46px; }",
    ".rs-act-call { background: #53313B; color: #FCEEEF; border: 1px solid rgba(185, 168, 172, 0.15); }",
    ".rs-act-call:hover { background: #6B4350; }",
    ".rs-act-wa { background: rgba(37, 167, 80, 0.9); color: #fff; }",
    ".rs-act-wa:hover { background: rgba(37, 167, 80, 1); }",
    ".rs-act-quote { background: rgba(185, 168, 172, 0.1); color: #B9A8AC; border: 1px solid rgba(185, 168, 172, 0.2); }",
    ".rs-act-quote:hover { background: rgba(185, 168, 172, 0.18); color: #F5F0E8; }",

    /* Mobile bottom quick-contact bar */
    ".rs-quick-contact { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 45; padding: 8px 14px calc(env(safe-area-inset-bottom, 0px) + 8px) 14px; background: linear-gradient(to top, rgba(14, 7, 9, 0.96) 65%, rgba(14, 7, 9, 0) 100%); pointer-events: none; transition: opacity 0.3s ease; }",
    ".rs-quick-inner { display: flex; gap: 10px; pointer-events: auto; max-width: 420px; margin: 0 auto; }",
    ".rs-quick-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 14px; border-radius: 100px; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; text-decoration: none; transition: all 0.25s; min-height: 46px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5); }",
    ".rs-quick-call { background: rgba(83, 49, 59, 0.92); color: #FCEEEF; border: 1px solid rgba(185, 168, 172, 0.18); }",
    ".rs-quick-call:hover { background: #6B4350; }",
    ".rs-quick-wa { background: rgba(37, 167, 80, 0.92); color: #fff; border: 1px solid rgba(37, 211, 102, 0.25); }",
    ".rs-quick-wa:hover { background: rgba(37, 167, 80, 1); }",

    /* Accessibility focus rings */
    ".rs-quick-btn:focus-visible, .rs-act-btn:focus-visible, .nav-cta-btn:focus-visible, .nav-phone:focus-visible { outline: 2px solid #7A4F5E; outline-offset: 2px; }",

    /* ════ Responsive Breakpoint (<= 992px) ════ */
    "@media (max-width: " + BREAKPOINT + "px) {",
    "  #mainnav { padding: 12px 16px !important; box-sizing: border-box !important; }",
    "  #mainnav .nav-links { display: none !important; }",
    "  #mainnav .nav-phone { display: none !important; }",
    "  #mainnav .nav-right { gap: 10px !important; flex-shrink: 0 !important; }",
    "  #mainnav .nav-cta-btn { padding: 8px 16px !important; font-size: 11px !important; }",
    "  .rs-hamburger { display: flex !important; width: 44px !important; height: 44px !important; min-width: 44px !important; min-height: 44px !important; padding: 0 !important; margin: 0 !important; flex-shrink: 0 !important; }",
    "  .rs-quick-contact { display: block; }",
    "  body { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 104px) !important; }",
    "}",

    /* ════ Desktop Breakpoint (> 992px) ════ */
    "@media (min-width: " + (BREAKPOINT + 1) + "px) {",
    "  .rs-drawer, .rs-drawer-overlay { display: none !important; }",
    "  .rs-quick-contact { display: none !important; }",
    "  .rs-hamburger { display: none !important; }",
    "}",

    /* Prevent scrolling when drawer is open */
    "body.rs-drawer-open { overflow: hidden !important; }",

    /* Prefers reduced motion */
    "@media (prefers-reduced-motion: reduce) {",
    "  .rs-drawer, .rs-drawer-overlay { transition: none !important; }",
    "}"
  ].join("\n");

  /* Ensure style is appended to head */
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      document.head.appendChild(style);
    });
  }

  /* ── Build Navigation DOM ── */
  function buildNav() {
    var nav = document.getElementById("mainnav");
    if (!nav) return;

    /* Build desktop links HTML */
    var linksHtml = NAV_LINKS.map(function (link) {
      var cls = isActive(link.href) ? ' class="rs-active"' : "";
      return '<a href="' + link.href + '"' + cls + ">" + link.label + "</a>";
    }).join("");

    /* Build drawer links HTML */
    var drawerLinksHtml = NAV_LINKS.map(function (link) {
      var cls = isActive(link.href) ? ' class="rs-active"' : "";
      return '<li><a href="' + link.href + '"' + cls + ">" + link.label + "</a></li>";
    }).join("");

    /* Construct navbar contents */
    nav.innerHTML = [
      '<a class="nav-logo" href="index.html">',
      '  <img src="Logo.jpeg" alt="Riddhi Siddhi Fabricator Logo">',
      '  <span>Riddhi Siddhi</span>',
      '</a>',
      '<div class="nav-links">' + linksHtml + '</div>',
      '<div class="nav-right">',
      '  <a class="nav-phone" href="' + PHONE_TEL + '" aria-label="Call ' + PHONE + '">' + ICON_PHONE + '<span>' + PHONE + '</span></a>',
      '  <a class="nav-cta-btn" href="quote.html">Get Quote</a>',
      '  <button class="rs-hamburger" id="rs-hamburger" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="rs-drawer">' + ICON_HAMBURGER + '</button>',
      '</div>'
    ].join("\n");

    /* Create drawer overlay if not present */
    var overlay = document.getElementById("rs-drawer-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "rs-drawer-overlay";
      overlay.id = "rs-drawer-overlay";
      document.body.appendChild(overlay);
    }

    /* Create drawer panel if not present */
    var drawer = document.getElementById("rs-drawer");
    if (!drawer) {
      drawer = document.createElement("aside");
      drawer.className = "rs-drawer";
      drawer.id = "rs-drawer";
      drawer.setAttribute("role", "dialog");
      drawer.setAttribute("aria-modal", "true");
      drawer.setAttribute("aria-label", "Navigation menu");
      document.body.appendChild(drawer);
    }

    drawer.innerHTML = [
      '<div class="rs-drawer-header">',
      '  <a class="rs-drawer-brand" href="index.html">',
      '    <img src="Logo.jpeg" alt="Riddhi Siddhi Fabricator Logo">',
      '    <span>Riddhi Siddhi</span>',
      '  </a>',
      '  <button class="rs-drawer-close" id="rs-drawer-close" type="button" aria-label="Close navigation menu">' + ICON_CLOSE + '</button>',
      '</div>',
      '<ul class="rs-drawer-nav">' + drawerLinksHtml + '</ul>',
      '<div class="rs-drawer-actions">',
      '  <a class="rs-act-btn rs-act-call" href="' + PHONE_TEL + '">' + ICON_PHONE + ' Call ' + PHONE + '</a>',
      '  <a class="rs-act-btn rs-act-wa" href="' + WHATSAPP_URL + '" target="_blank" rel="noopener">' + ICON_WA + ' WhatsApp</a>',
      '  <a class="rs-act-btn rs-act-quote" href="quote.html">' + ICON_ARROW + ' Get a Quote</a>',
      '</div>'
    ].join("\n");

    /* Create mobile quick-contact bar if not present */
    var quickBar = document.getElementById("rs-quick-contact");
    if (!quickBar) {
      quickBar = document.createElement("div");
      quickBar.className = "rs-quick-contact";
      quickBar.id = "rs-quick-contact";
      quickBar.setAttribute("aria-label", "Quick contact");
      document.body.appendChild(quickBar);
    }

    quickBar.innerHTML = [
      '<div class="rs-quick-inner">',
      '  <a class="rs-quick-btn rs-quick-call" href="' + PHONE_TEL + '" aria-label="Call ' + PHONE + '">' + ICON_PHONE + ' Call</a>',
      '  <a class="rs-quick-btn rs-quick-wa" href="' + WHATSAPP_URL + '" target="_blank" rel="noopener" aria-label="WhatsApp ' + PHONE + '">' + ICON_WA + ' WhatsApp</a>',
      '</div>'
    ].join("\n");

    /* ── Bind drawer interactions ── */
    var hamburger = document.getElementById("rs-hamburger") || (nav && nav.querySelector("#rs-hamburger"));
    var closeBtn = document.getElementById("rs-drawer-close") || (drawer && drawer.querySelector("#rs-drawer-close"));
    var lastFocused = null;

    if (!hamburger || !closeBtn || !drawer || !overlay) return;

    function openDrawer() {
      lastFocused = document.activeElement;
      hamburger.setAttribute("aria-expanded", "true");
      drawer.classList.add("open");
      overlay.classList.add("open");
      document.body.classList.add("rs-drawer-open");
      setTimeout(function () {
        if (closeBtn) closeBtn.focus();
      }, 60);
    }

    function closeDrawer() {
      hamburger.setAttribute("aria-expanded", "false");
      drawer.classList.remove("open");
      overlay.classList.remove("open");
      document.body.classList.remove("rs-drawer-open");
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }

    hamburger.addEventListener("click", function () {
      var isOpen = hamburger.getAttribute("aria-expanded") === "true";
      isOpen ? closeDrawer() : openDrawer();
    });

    closeBtn.addEventListener("click", closeDrawer);
    overlay.addEventListener("click", closeDrawer);

    /* Close on ESC */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("open")) {
        closeDrawer();
      }
    });

    /* Trap focus inside drawer */
    drawer.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusable = drawer.querySelectorAll("a[href], button:not([disabled])");
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    /* Close drawer on in-page link navigation */
    var drawerLinks = drawer.querySelectorAll(".rs-drawer-nav a");
    drawerLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        closeDrawer();
      });
    });

    /* Auto-close on resize to desktop */
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (window.innerWidth > BREAKPOINT && drawer.classList.contains("open")) {
          closeDrawer();
        }
      }, 100);
    });

    /* Fade out quick contact bar when reaching footer */
    var footerEl = document.querySelector(".site-footer, footer");
    if (quickBar && footerEl && "IntersectionObserver" in window) {
      var qcObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          quickBar.style.opacity = entry.isIntersecting ? "0" : "1";
          quickBar.style.pointerEvents = entry.isIntersecting ? "none" : "auto";
        });
      }, { threshold: 0.1 });
      qcObserver.observe(footerEl);
    }
  }

  /* ── Boot ── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildNav);
  } else {
    buildNav();
  }
})();

(function () {
  "use strict";

  var instances = new Map();
  var rafSyncRequested = false;
  var resizeTimer = null;
  var SCROLL_DELTA_THRESHOLD = 2;

  function parseIntSafe(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getDeviceType() {
    var width = window.innerWidth || document.documentElement.clientWidth || 0;
    if (width <= 767) {
      return "mobile";
    }
    if (width <= 1024) {
      return "tablet";
    }
    return "desktop";
  }

  function getAdminBarOffset() {
    if (!document.body || !document.body.classList.contains("admin-bar")) {
      return 0;
    }

    var adminBar = document.getElementById("wpadminbar");
    if (!adminBar) {
      return 0;
    }

    var isFixed = window.getComputedStyle(adminBar).position === "fixed";
    if (!isFixed) {
      return 0;
    }

    return adminBar.offsetHeight || 0;
  }

  function measure(instance) {
    var el = instance.el;
    var rect = el.getBoundingClientRect();
    instance.width = rect.width;
    instance.left = rect.left;
    instance.height = rect.height;

    if (instance.isSticky) {
      instance.anchorTop = instance.placeholder.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
      return;
    }

    instance.anchorTop = rect.top + (window.scrollY || window.pageYOffset || 0);
  }

  function applySticky(instance) {
    if (instance.isSticky) {
      return;
    }

    var el = instance.el;
    var placeholder = instance.placeholder;
    var adminOffset = getAdminBarOffset();

    measure(instance);

    placeholder.style.height = instance.height + "px";
    el.style.width = instance.width + "px";
    el.style.left = instance.left + "px";
    el.style.top = adminOffset + "px";

    el.classList.add("dsh-is-sticky");

    if (instance.animation !== "none") {
      el.classList.remove("dsh-anim-fade-in-down");
      void el.offsetWidth;
      if (instance.animation === "fade_in_down") {
        el.classList.add("dsh-anim-fade-in-down");
      }
    }

    instance.isSticky = true;
  }

  function clearSticky(instance) {
    if (!instance.isSticky) {
      return;
    }

    var el = instance.el;
    var placeholder = instance.placeholder;

    el.classList.remove("dsh-is-sticky");
    el.classList.remove("dsh-anim-fade-in-down");
    el.style.removeProperty("top");
    el.style.removeProperty("left");
    el.style.removeProperty("width");
    placeholder.style.height = "0px";

    instance.isSticky = false;
  }

  function syncInstance(instance) {
    var allowed = instance.devices.indexOf(getDeviceType()) !== -1;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var delta = scrollY - instance.lastScrollY;
    var scrollingDown = delta > SCROLL_DELTA_THRESHOLD;
    var scrollingUp = delta < -SCROLL_DELTA_THRESHOLD;
    var shouldStick = scrollingDown && scrollY >= instance.anchorTop + instance.delay;

    instance.lastScrollY = scrollY;

    if (!allowed) {
      clearSticky(instance);
      return;
    }

    if (scrollingUp) {
      clearSticky(instance);
      return;
    }

    if (shouldStick) {
      applySticky(instance);
    }
  }

  function syncAll() {
    rafSyncRequested = false;
    instances.forEach(function (instance) {
      syncInstance(instance);
    });
  }

  function requestSync() {
    if (rafSyncRequested) {
      return;
    }
    rafSyncRequested = true;
    window.requestAnimationFrame(syncAll);
  }

  function onScroll() {
    requestSync();
  }

  function onResize() {
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }

    resizeTimer = window.setTimeout(function () {
      instances.forEach(function (instance) {
        clearSticky(instance);
        measure(instance);
      });
      requestSync();
    }, 80);
  }

  function createInstance(el) {
    if (!el || instances.has(el)) {
      return;
    }

    var enabled = el.getAttribute("data-dsh-enabled");
    if (enabled !== "yes") {
      return;
    }

    var placeholder = document.createElement("div");
    placeholder.className = "dsh-sticky-placeholder";
    placeholder.style.height = "0px";

    if (el.parentNode) {
      el.parentNode.insertBefore(placeholder, el);
    }

    var devicesRaw = (el.getAttribute("data-dsh-devices") || "desktop,tablet,mobile").split(",");
    var devices = devicesRaw
      .map(function (device) {
        return (device || "").trim();
      })
      .filter(Boolean);

    var duration = Math.max(0, parseIntSafe(el.getAttribute("data-dsh-duration"), 260));
    var easing = el.getAttribute("data-dsh-easing") || "cubic-bezier(0.22,1,0.36,1)";

    el.style.setProperty("--dsh-anim-duration", duration + "ms");
    el.style.setProperty("--dsh-anim-easing", easing);

    var instance = {
      el: el,
      placeholder: placeholder,
      delay: Math.max(0, parseIntSafe(el.getAttribute("data-dsh-delay"), 0)),
      animation: el.getAttribute("data-dsh-down-animation") || "fade_in_down",
      devices: devices.length ? devices : ["desktop", "tablet", "mobile"],
      anchorTop: 0,
      left: 0,
      width: 0,
      height: 0,
      isSticky: false,
      lastScrollY: window.scrollY || window.pageYOffset || 0,
    };

    measure(instance);
    instances.set(el, instance);
  }

  function initScope(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var targets = scope.querySelectorAll(".dsh-sticky-target[data-dsh-enabled='yes']");

    targets.forEach(function (el) {
      createInstance(el);
    });

    requestSync();
  }

  function bindElementorHooks() {
    if (typeof window.elementorFrontend === "undefined" || !window.elementorFrontend.hooks) {
      return;
    }

    window.elementorFrontend.hooks.addAction("frontend/element_ready/container", function ($scope) {
      if (!$scope || !$scope[0]) {
        return;
      }

      initScope($scope[0]);
    });
  }

  function init() {
    initScope(document);
    bindElementorHooks();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

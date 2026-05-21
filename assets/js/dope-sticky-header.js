(function () {
  "use strict";

  var instances = new Map();
  var rafSyncRequested = false;
  var resizeTimer = null;
  var SCROLL_DELTA_THRESHOLD = 2;
  var REENTER_SCROLL_GUARD = 24;
  var MAX_EXIT_DURATION = 320;

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

    if (window.getComputedStyle(adminBar).position !== "fixed") {
      return 0;
    }

    return adminBar.offsetHeight || 0;
  }

  function clearInstanceTimers(instance) {
    if (instance.exitFallbackTimer) {
      window.clearTimeout(instance.exitFallbackTimer);
      instance.exitFallbackTimer = null;
    }
  }

  function removeInstanceAnimationListeners(instance) {
    var el = instance.el;

    if (instance.exitEndHandler) {
      el.removeEventListener("animationend", instance.exitEndHandler);
      instance.exitEndHandler = null;
    }
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

  function finishClearSticky(instance) {
    var el = instance.el;
    var placeholder = instance.placeholder;

    removeInstanceAnimationListeners(instance);
    clearInstanceTimers(instance);

    el.classList.remove("dsh-is-sticky");
    el.classList.remove("dsh-anim-fade-in-down");
    el.classList.remove("dsh-anim-slide-up-out");
    el.style.removeProperty("top");
    el.style.removeProperty("left");
    el.style.removeProperty("width");
    placeholder.style.height = "0px";

    instance.isSticky = false;
    instance.state = "normal";
    instance.lastExitScrollY = window.scrollY || window.pageYOffset || 0;
  }

  function cancelExit(instance) {
    if (instance.state !== "exiting") {
      return;
    }

    removeInstanceAnimationListeners(instance);
    clearInstanceTimers(instance);
    instance.el.classList.remove("dsh-anim-slide-up-out");
    instance.state = "stuck";
  }

  function applySticky(instance) {
    var el = instance.el;
    var placeholder = instance.placeholder;

    if (instance.state === "exiting") {
      cancelExit(instance);
    }

    if (instance.isSticky) {
      if (instance.state === "normal") {
        instance.state = "stuck";
      }
      return;
    }

    removeInstanceAnimationListeners(instance);
    clearInstanceTimers(instance);

    measure(instance);

    placeholder.style.height = instance.height + "px";
    el.style.width = instance.width + "px";
    el.style.left = instance.left + "px";
    el.style.top = getAdminBarOffset() + "px";

    el.classList.remove("dsh-anim-slide-up-out");
    el.classList.add("dsh-is-sticky");

    instance.isSticky = true;

    if (instance.animation !== "none") {
      el.classList.remove("dsh-anim-fade-in-down");
      void el.offsetWidth;
      if (instance.animation === "fade_in_down") {
        el.classList.add("dsh-anim-fade-in-down");
      }
    }

    instance.state = "stuck";
  }

  function startExit(instance) {
    var el = instance.el;
    var exitDuration = Math.min(instance.duration, MAX_EXIT_DURATION);

    if (!instance.isSticky) {
      finishClearSticky(instance);
      return;
    }

    if (instance.state === "exiting") {
      return;
    }

    removeInstanceAnimationListeners(instance);
    clearInstanceTimers(instance);

    el.classList.remove("dsh-anim-fade-in-down");

    if (exitDuration <= 0) {
      finishClearSticky(instance);
      return;
    }

    instance.state = "exiting";
    createExitGhost(instance, exitDuration);
    finishClearSticky(instance);
  }

  function createExitGhost(instance, exitDuration) {
    var el = instance.el;
    var rect = el.getBoundingClientRect();
    var ghost = el.cloneNode(true);
    var ghostHost = el.parentNode || document.body;

    ghost.classList.remove("dsh-is-sticky");
    ghost.classList.remove("dsh-anim-fade-in-down");
    ghost.classList.remove("dsh-sticky-target");
    ghost.classList.add("dsh-exit-ghost");
    ghost.classList.add("dsh-anim-slide-up-out");
    ghost.removeAttribute("id");
    ghost.removeAttribute("data-dsh-enabled");
    ghost.removeAttribute("data-dsh-delay");
    ghost.removeAttribute("data-dsh-up-hide-distance");
    ghost.removeAttribute("data-dsh-down-animation");
    ghost.removeAttribute("data-dsh-duration");
    ghost.removeAttribute("data-dsh-easing");
    ghost.removeAttribute("data-dsh-devices");
    ghost.removeAttribute("data-dsh-had-native");
    ghost.style.setProperty("--dsh-exit-duration", exitDuration + "ms");
    ghost.style.setProperty("--dsh-anim-easing", getComputedStyle(el).getPropertyValue("--dsh-anim-easing") || "cubic-bezier(0.22,1,0.36,1)");
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";

    ghostHost.appendChild(ghost);

    var cleanup = function () {
      if (ghost && ghost.parentNode) {
        ghost.parentNode.removeChild(ghost);
      }
    };

    ghost.addEventListener("animationend", function (event) {
      if (event.target !== ghost) {
        return;
      }
      cleanup();
    });

    window.setTimeout(cleanup, exitDuration + 120);
  }

  function syncInstance(instance) {
    var allowed = instance.devices.indexOf(getDeviceType()) !== -1;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var delta = scrollY - instance.lastScrollY;
    var scrollingDown = delta > SCROLL_DELTA_THRESHOLD;
    var scrollingUp = delta < -SCROLL_DELTA_THRESHOLD;
    var shouldEnterSticky = scrollingDown && scrollY >= instance.anchorTop + instance.delay;
    var shouldReleaseSticky = scrollingUp && scrollY <= instance.anchorTop + instance.upHideDistance;
    var passedReenterGuard = scrollY >= instance.lastExitScrollY + REENTER_SCROLL_GUARD;

    instance.lastScrollY = scrollY;

    if (!allowed) {
      finishClearSticky(instance);
      return;
    }

    if (instance.state === "exiting") {
      if (shouldEnterSticky) {
        cancelExit(instance);
      }
      return;
    }

    if (!instance.isSticky) {
      if (shouldEnterSticky && passedReenterGuard) {
        applySticky(instance);
      }
      return;
    }

    if (shouldReleaseSticky) {
      startExit(instance);
      return;
    }

    if (instance.state === "normal") {
      instance.state = "stuck";
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
        finishClearSticky(instance);
        measure(instance);
      });
      requestSync();
    }, 80);
  }

  function createInstance(el) {
    if (!el || instances.has(el)) {
      return;
    }

    if (el.getAttribute("data-dsh-enabled") !== "yes") {
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
      upHideDistance: Math.max(0, parseIntSafe(el.getAttribute("data-dsh-up-hide-distance"), 250)),
      animation: el.getAttribute("data-dsh-down-animation") || "fade_in_down",
      duration: duration,
      devices: devices.length ? devices : ["desktop", "tablet", "mobile"],
      anchorTop: 0,
      left: 0,
      width: 0,
      height: 0,
      isSticky: false,
      state: "normal",
      lastScrollY: window.scrollY || window.pageYOffset || 0,
      lastExitScrollY: -Infinity,
      exitEndHandler: null,
      exitFallbackTimer: null,
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

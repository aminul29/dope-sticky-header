(function () {
  "use strict";

  var instances = new Map();
  var rafSyncRequested = false;
  var resizeTimer = null;
  var SCROLL_DELTA_THRESHOLD = 2;
  var lastWindowWidth = window.innerWidth || document.documentElement.clientWidth || 0;

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

    // Get computed margins of the element
    var style = window.getComputedStyle(el);
    instance.marginTop = parseInt(style.marginTop, 10) || 0;
    instance.marginBottom = parseInt(style.marginBottom, 10) || 0;

    if (instance.isSticky) {
      instance.anchorTop = instance.placeholder.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0) - instance.marginTop;
      return;
    }

    instance.anchorTop = rect.top + (window.scrollY || window.pageYOffset || 0) - instance.marginTop;
  }

  function calculateStickyOffset(currentInstance) {
    var offset = getAdminBarOffset();
    var currentPassed = false;

    instances.forEach(function (instance) {
      if (instance === currentInstance) {
        currentPassed = true;
      }
      if (!currentPassed && instance.isSticky) {
        var isHidden = instance.el.classList.contains("dsh-sticky-hide");
        if (!isHidden) {
          var currentTranslateY = instance.currentTranslateY || 0;
          var factor = instance.height > 0 ? (instance.height + currentTranslateY) / instance.height : 0;
          if (factor < 0) factor = 0;
          if (factor > 1) factor = 1;
          offset += (instance.height + instance.marginTop + instance.marginBottom) * factor;
        }
      }
    });

    return offset;
  }

  function updateStickyPositions() {
    instances.forEach(function (instance) {
      if (instance.isSticky) {
        var offset = calculateStickyOffset(instance);
        instance.el.style.top = offset + "px";
      }
    });
  }

  function applySticky(instance) {
    if (instance.isSticky) {
      return;
    }

    var el = instance.el;
    var placeholder = instance.placeholder;

    measure(instance);

    // Set placeholder to take identical layout space
    placeholder.style.height = instance.height + "px";
    placeholder.style.marginTop = instance.marginTop + "px";
    placeholder.style.marginBottom = instance.marginBottom + "px";

    el.style.width = instance.width + "px";
    el.style.left = instance.left + "px";

    el.classList.add("dsh-is-sticky");

    if (instance.revealType === "scroll_linked") {
      el.classList.add("dsh-interactive-scroll");
      instance.currentTranslateY = 0;
      el.style.transform = "translateY(0px) translateZ(0)";
      el.style.opacity = "1";
      el.style.pointerEvents = "";
    } else if (instance.animation !== "none") {
      el.classList.remove("dsh-anim-fade-in-down");
      void el.offsetWidth;
      if (instance.animation === "fade_in_down") {
        el.classList.add("dsh-anim-fade-in-down");
      }
    }

    instance.isSticky = true;
    updateStickyPositions();
  }

  function clearSticky(instance) {
    if (!instance.isSticky) {
      return;
    }

    var el = instance.el;
    var placeholder = instance.placeholder;

    el.classList.remove("dsh-is-sticky");
    el.classList.remove("dsh-anim-fade-in-down");
    el.classList.remove("dsh-sticky-hide");
    el.classList.remove("dsh-interactive-scroll");
    el.style.removeProperty("top");
    el.style.removeProperty("left");
    el.style.removeProperty("width");
    el.style.removeProperty("transform");
    el.style.removeProperty("opacity");
    el.style.removeProperty("pointer-events");

    placeholder.style.height = "0px";
    placeholder.style.removeProperty("margin-top");
    placeholder.style.removeProperty("margin-bottom");

    instance.isSticky = false;
    instance.currentTranslateY = 0;
    updateStickyPositions();
  }

  function hideSticky(instance) {
    if (!instance.isSticky) {
      return;
    }
    if (!instance.el.classList.contains("dsh-sticky-hide")) {
      instance.el.classList.add("dsh-sticky-hide");
      updateStickyPositions();
    }
  }

  function showSticky(instance) {
    if (!instance.isSticky) {
      return;
    }
    if (instance.el.classList.contains("dsh-sticky-hide")) {
      instance.el.classList.remove("dsh-sticky-hide");
      updateStickyPositions();
    }
  }

  function syncInstance(instance) {
    var allowed = instance.devices.indexOf(getDeviceType()) !== -1;
    var scrollY = window.scrollY || window.pageYOffset || 0;

    // Normalize negative scroll values (e.g. bounce on iOS)
    if (scrollY < 0) {
      scrollY = 0;
    }

    // Determine if we should be sticky. Use a 10px hysteresis buffer to prevent boundary flickering,
    // but disable it for interactive scroll_linked reveal type to ensure seamless return to original position.
    var stickyThreshold = instance.anchorTop + instance.delay;
    var useHysteresis = instance.revealType !== "scroll_linked";
    var shouldStick = allowed && (instance.isSticky && useHysteresis ? (scrollY >= stickyThreshold - 10) : (scrollY >= stickyThreshold));

    if (shouldStick) {
      if (!instance.isSticky) {
        applySticky(instance);
        instance.lastScrollY = scrollY;
        instance.scrollAccumulator = 0;
      }

      var delta = scrollY - instance.lastScrollY;

      if (instance.revealType === "scroll_linked") {
        var maxOffset = -instance.height;
        var prevTranslateY = instance.currentTranslateY;
        instance.currentTranslateY = Math.max(maxOffset, Math.min(0, instance.currentTranslateY - delta));

        if (instance.currentTranslateY !== prevTranslateY) {
          var factor = instance.height > 0 ? (instance.height + instance.currentTranslateY) / instance.height : 0;
          if (factor < 0) factor = 0;
          if (factor > 1) factor = 1;

          instance.el.style.transform = "translateY(" + instance.currentTranslateY + "px) translateZ(0)";
          instance.el.style.opacity = factor;
          instance.el.style.pointerEvents = factor === 0 ? "none" : "";

          updateStickyPositions();
        }
      } else {
        // Accumulate scroll distance in the current direction to smooth out recoil/bounce
        if (delta > 0) {
          if (instance.scrollAccumulator < 0) {
            instance.scrollAccumulator = 0;
          }
          instance.scrollAccumulator += delta;
        } else if (delta < 0) {
          if (instance.scrollAccumulator > 0) {
            instance.scrollAccumulator = 0;
          }
          instance.scrollAccumulator += delta;
        }

        // If direction-aware (CSS-driven), hide on scroll down (with 20px tolerance), show on scroll up (with 15px tolerance)
        if (instance.revealType === "direction") {
          var toleranceDown = 20;
          var toleranceUp = 15;
          if (instance.scrollAccumulator > toleranceDown && scrollY > stickyThreshold + 100) {
            hideSticky(instance);
          } else if (instance.scrollAccumulator < -toleranceUp) {
            showSticky(instance);
          }
        } else {
          showSticky(instance);
        }
      }
    } else {
      if (instance.isSticky) {
        clearSticky(instance);
      }
    }

    instance.lastScrollY = scrollY;
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
    var newWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    if (newWidth === lastWindowWidth) {
      return; // Ignore height-only resizes (like mobile address bar toggles)
    }
    lastWindowWidth = newWidth;

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

    var revealType = el.getAttribute("data-dsh-reveal-type") || "standard";
    var directionAware = el.getAttribute("data-dsh-direction-aware") === "yes";
    if (revealType === "standard" && directionAware) {
      revealType = "direction";
    }

    var instance = {
      el: el,
      placeholder: placeholder,
      delay: Math.max(0, parseIntSafe(el.getAttribute("data-dsh-delay"), 0)),
      animation: el.getAttribute("data-dsh-down-animation") || "fade_in_down",
      devices: devices.length ? devices : ["desktop", "tablet", "mobile"],
      directionAware: directionAware,
      revealType: revealType,
      anchorTop: 0,
      left: 0,
      width: 0,
      height: 0,
      isSticky: false,
      lastScrollY: window.scrollY || window.pageYOffset || 0,
      scrollAccumulator: 0,
      currentTranslateY: 0,
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

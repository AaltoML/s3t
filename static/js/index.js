document.addEventListener("DOMContentLoaded", () => {
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }

  const topButton = document.querySelector(".scroll-to-top");
  const worksButton = document.querySelector(".more-works-btn");
  const worksPanel = document.querySelector(".more-works-dropdown");
  const closeButton = document.querySelector(".close-btn");

  const initTabs = (root) => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];

    const selectTab = (tab, focus = false) => {
      tabs.forEach((candidate) => {
        const selected = candidate === tab;
        candidate.setAttribute("aria-selected", String(selected));
        candidate.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(candidate.getAttribute("aria-controls"));
        panel.hidden = !selected;
        if (!selected) {
          panel.querySelectorAll("video").forEach((video) => video.pause());
        }
      });
      if (focus) tab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectTab(tab));
      tab.addEventListener("keydown", (event) => {
        const offsets = {
          "ArrowLeft": -1,
          "ArrowRight": 1,
          "Home": -index,
          "End": tabs.length - index - 1,
        };

        if (event.key in offsets) {
          event.preventDefault();
          const nextIndex = (index + offsets[event.key] + tabs.length) % tabs.length;
          selectTab(tabs[nextIndex], true);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectTab(tab);
        }
      });
    });

    const videoTabs = tabs.flatMap((tab) => {
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      const video = panel.querySelector("video");
      return video ? [{ tab, video }] : [];
    });

    videoTabs.forEach(({ tab, video }, index) => {
      video.addEventListener("ended", () => {
        if (tab.getAttribute("aria-selected") !== "true") return;

        const next = videoTabs[(index + 1) % videoTabs.length];
        selectTab(next.tab);
        next.video.currentTime = 0;

        const playback = next.video.play();
        if (playback) playback.catch(() => {});
      });
    });
  };

  document.querySelectorAll("[data-tabs]").forEach(initTabs);

  const setWorksOpen = (open) => {
    worksButton.setAttribute("aria-expanded", String(open));
    worksPanel.hidden = !open;
  };

  worksButton.addEventListener("click", () => {
    setWorksOpen(worksButton.getAttribute("aria-expanded") !== "true");
  });
  closeButton.addEventListener("click", () => setWorksOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setWorksOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".more-works-container")) setWorksOpen(false);
  });

  window.addEventListener("scroll", () => {
    topButton.classList.toggle("is-visible", window.scrollY > 500);
  }, { passive: true });
  topButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
});

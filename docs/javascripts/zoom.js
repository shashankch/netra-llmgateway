// NETRA Documentation — Interactive Click-to-Zoom Lightbox
document.addEventListener("DOMContentLoaded", function () {
  function initImageZoom() {
    const contentImages = document.querySelectorAll(".md-content img");
    contentImages.forEach(img => {
      // Don't re-bind if already handled
      if (img.dataset.zoomAttached) return;

      // Never attach zoom to badges, links, icons, or explicitly excluded images
      if (
        img.closest("a") ||
        (img.src && (img.src.includes("shields.io") || img.src.includes("/icons/"))) ||
        img.classList.contains("no-zoom") ||
        img.hasAttribute("data-no-zoom")
      ) {
        img.dataset.zoomAttached = "skipped";
        return;
      }

      img.dataset.zoomAttached = "true";

      img.addEventListener("click", function (e) {
        e.stopPropagation();

        const overlay = document.createElement("div");
        overlay.className = "netra-image-overlay";

        const zoomedImg = document.createElement("img");
        zoomedImg.src = img.currentSrc || img.src;
        zoomedImg.alt = img.alt || "Enlarged Diagram";

        const cleanCaption = (img.alt || "")
          .replace(/\s*\((?:Light|Dark)\s+Mode\)/gi, "")
          .trim();

        overlay.appendChild(zoomedImg);
        if (cleanCaption) {
          const caption = document.createElement("div");
          caption.className = "netra-image-caption";
          caption.textContent = cleanCaption;
          overlay.appendChild(caption);
        }
        document.body.appendChild(overlay);

        function closeOverlay() {
          overlay.style.opacity = "0";
          setTimeout(() => overlay.remove(), 200);
          document.removeEventListener("keydown", onKeyDown);
        }

        function onKeyDown(evt) {
          if (evt.key === "Escape") closeOverlay();
        }

        overlay.addEventListener("click", closeOverlay);
        document.addEventListener("keydown", onKeyDown);
      });
    });
  }

  initImageZoom();

  // Support Zensical / MkDocs Material instant navigation (page switches without full reload)
  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(initImageZoom);
  }
});

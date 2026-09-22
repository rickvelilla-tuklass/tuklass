/* Tuklass V9.2 install/download experience. */
(function () {
    "use strict";

    let deferredInstallPrompt = null;

    function config() {
        return window.TUKLASS_CONFIG || {};
    }

    function downloads() {
        return config().downloads || {};
    }

    function isStandalone() {
        return !!(
            window.matchMedia && window.matchMedia("(display-mode: standalone)").matches
        ) || window.navigator.standalone === true;
    }

    function ua() {
        return String(navigator.userAgent || "").toLowerCase();
    }

    function platformGuess() {
        const value = ua();
        if (/iphone|ipad|ipod/.test(value)) return "ios";
        if (/android/.test(value)) return "android";
        if (/windows/.test(value)) return "windows";
        if (/macintosh|mac os x/.test(value)) return "macos";
        return "other";
    }

    function friendlyPlatform(platform) {
        return ({
            android: "Android",
            ios: "iPhone & iPad",
            windows: "Windows",
            macos: "macOS"
        })[platform] || "your device";
    }

    function instructions(platform) {
        if (platform === "ios") {
            return "Open Tuklass in Safari, tap the Share button, then choose Add to Home Screen.";
        }
        if (platform === "android") {
            return "Open Tuklass in Chrome, tap the menu (⋮), then choose Install app or Add to Home screen.";
        }
        if (platform === "windows") {
            return "Open Tuklass in Edge or Chrome, then use the Install app button in the address bar or browser menu.";
        }
        if (platform === "macos") {
            return "In Safari, choose File → Add to Dock. In Chrome, use Install Tuklass from the address bar or browser menu.";
        }
        return "Use your browser's Install app or Add to Home Screen option.";
    }

    function ensureModal() {
        let modal = document.getElementById("tuklassDownloadModal");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "tuklassDownloadModal";
        modal.className = "tuklass-download-modal";
        modal.hidden = true;
        modal.innerHTML = `
            <button class="tuklass-download-backdrop" type="button" aria-label="Close download window"></button>
            <section class="tuklass-download-card" role="dialog" aria-modal="true" aria-labelledby="tuklassDownloadTitle">
                <button class="tuklass-download-close" type="button" aria-label="Close">×</button>
                <div class="tuklass-download-heading">
                    <span class="tuklass-download-mark">↓</span>
                    <div>
                        <span class="notes-section-kicker">Tuklass on every device</span>
                        <h2 id="tuklassDownloadTitle">Download Tuklass</h2>
                        <p>Install Tuklass like an app now, or connect native App Store / Play Store links later.</p>
                    </div>
                </div>
                <div class="tuklass-download-platforms">
                    <button type="button" data-download-platform="android"><span>Android</span><small>Phone & tablet</small><b>Install</b></button>
                    <button type="button" data-download-platform="ios"><span>iPhone & iPad</span><small>iOS / iPadOS</small><b>Install</b></button>
                    <button type="button" data-download-platform="windows"><span>Windows</span><small>PC & laptop</small><b>Install</b></button>
                    <button type="button" data-download-platform="macos"><span>macOS</span><small>Mac</small><b>Install</b></button>
                </div>
                <div id="tuklassDownloadInstructions" class="tuklass-download-instructions" aria-live="polite"></div>
                <p class="tuklass-download-footnote">Tuklass currently supports installable web-app mode. When you publish native apps, add the store links in <code>tuklass-config.js</code>.</p>
            </section>`;
        document.body.appendChild(modal);

        modal.querySelector(".tuklass-download-backdrop").addEventListener("click", close);
        modal.querySelector(".tuklass-download-close").addEventListener("click", close);
        modal.querySelectorAll("[data-download-platform]").forEach(function (button) {
            button.addEventListener("click", function () {
                installFor(button.dataset.downloadPlatform);
            });
        });
        return modal;
    }

    function setInstruction(message, success) {
        const el = document.getElementById("tuklassDownloadInstructions");
        if (!el) return;
        el.textContent = message || "";
        el.classList.toggle("success", !!success);
        el.hidden = !message;
    }

    function refreshButtons() {
        const modal = document.getElementById("tuklassDownloadModal");
        if (!modal) return;
        const links = downloads();
        const installed = isStandalone();
        modal.querySelectorAll("[data-download-platform]").forEach(function (button) {
            const platform = button.dataset.downloadPlatform;
            const label = button.querySelector("b");
            if (!label) return;
            if (installed && platform === platformGuess()) label.textContent = "Installed";
            else if (links[platform]) label.textContent = "Download";
            else label.textContent = "Install";
        });
    }

    function open(platform) {
        const modal = ensureModal();
        modal.hidden = false;
        document.body.classList.add("tuklass-download-open");
        refreshButtons();
        const chosen = platform || platformGuess();
        if (isStandalone()) {
            setInstruction("Tuklass is already installed on this device.", true);
        } else if (chosen && chosen !== "other") {
            setInstruction("For " + friendlyPlatform(chosen) + ": " + instructions(chosen), false);
        } else {
            setInstruction("Choose your device below to see the install option.", false);
        }
    }

    function close() {
        const modal = document.getElementById("tuklassDownloadModal");
        if (modal) modal.hidden = true;
        document.body.classList.remove("tuklass-download-open");
    }

    async function installFor(platform) {
        const links = downloads();
        const url = String(links[platform] || "").trim();
        if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
            setInstruction("Opening the " + friendlyPlatform(platform) + " download page…", true);
            return;
        }

        if (isStandalone()) {
            setInstruction("Tuklass is already installed on this device.", true);
            return;
        }

        const guessed = platformGuess();
        const promptCapable = platform === guessed && deferredInstallPrompt && ["android", "windows", "macos"].includes(platform);
        if (promptCapable) {
            try {
                deferredInstallPrompt.prompt();
                const choice = await deferredInstallPrompt.userChoice;
                if (choice && choice.outcome === "accepted") {
                    setInstruction("Tuklass installation started.", true);
                    deferredInstallPrompt = null;
                    refreshButtons();
                    return;
                }
            } catch (_) {}
        }

        setInstruction(instructions(platform), false);
    }

    function injectButtons() {
        const header = document.getElementById("publicHeader");
        if (header && !document.getElementById("publicDownloadButton")) {
            const button = document.createElement("button");
            button.id = "publicDownloadButton";
            button.type = "button";
            button.className = "public-download-button";
            button.innerHTML = '<span aria-hidden="true">↓</span><span>Download</span>';
            button.addEventListener("click", function () { open(); });
            const profile = document.getElementById("profileArea");
            header.insertBefore(button, profile || null);
        }

        const dashboardGrid = document.querySelector("#dashboard .dashboard-grid");
        if (dashboardGrid && !document.getElementById("dashboardDownloadCard")) {
            const card = document.createElement("div");
            card.id = "dashboardDownloadCard";
            card.className = "dashboard-card dashboard-download-card";
            card.innerHTML = `
                <div class="dashboard-icon dashboard-download-icon" aria-hidden="true">↓</div>
                <h3>Download Tuklass</h3>
                <p>Install Tuklass on Android, iPhone & iPad, Windows, or macOS.</p>
                <button type="button" class="button primary" id="dashboardDownloadButton">Download app</button>`;
            dashboardGrid.appendChild(card);
            card.querySelector("#dashboardDownloadButton").addEventListener("click", function () { open(); });
        }
    }

    window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        refreshButtons();
    });

    window.addEventListener("appinstalled", function () {
        deferredInstallPrompt = null;
        setInstruction("Tuklass was installed successfully.", true);
        refreshButtons();
    });

    window.openTuklassDownloadModal = open;
    window.closeTuklassDownloadModal = close;
    window.installTuklassFor = installFor;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            ensureModal();
            injectButtons();
        }, {once:true});
    } else {
        ensureModal();
        injectButtons();
    }
})();

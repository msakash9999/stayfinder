/* global window, document, StayAuth */
(function () {
    function runGuard() {
        const body = document.body;
        if (!body) {
            return;
        }

        const protectedPage = body.dataset.protected === "true";
        if (!protectedPage) {
            return;
        }

        if (!window.StayAuth || !StayAuth.getToken()) {
            const nextPath = body.dataset.redirect || "index.html";
            window.location.replace("login.html?next=" + encodeURIComponent(nextPath));
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", runGuard);
    } else {
        runGuard();
    }
})();

/* global window, localStorage */
(function () {
    const TOKEN_KEY = "stayfinder_auth_token";

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token) {
        localStorage.setItem(TOKEN_KEY, token);
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
    }

    async function request(url, options) {
        const response = await fetch(url, options || {});
        return response;
    }

    async function login(apiBase, credentials) {
        const response = await request(apiBase + "/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials)
        });
        if (!response.ok) {
            const data = await response.json().catch(function () { return {}; });
            throw new Error(data.error || "Login failed");
        }
        const payload = await response.json();
        setToken(payload.token);
        return payload;
    }

    async function register(apiBase, payload) {
        const response = await request(apiBase + "/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const data = await response.json().catch(function () { return {}; });
            throw new Error(data.error || "Registration failed");
        }
        const data = await response.json();
        setToken(data.token);
        return data;
    }

    async function getMe(apiBase) {
        const token = getToken();
        if (!token) {
            throw new Error("Missing token");
        }
        const response = await request(apiBase + "/auth/me", {
            headers: { Authorization: "Bearer " + token }
        });
        if (!response.ok) {
            throw new Error("Unauthorized");
        }
        return response.json();
    }

    async function fetchWithAuth(url, options) {
        const token = getToken();
        if (!token) {
            throw new Error("Missing token");
        }

        const opts = options || {};
        const headers = Object.assign({}, opts.headers || {}, {
            Authorization: "Bearer " + token
        });

        const response = await request(url, Object.assign({}, opts, { headers: headers }));
        if (response.status === 401) {
            clearToken();
        }
        return response;
    }

    function redirectToLogin(nextPath) {
        const next = encodeURIComponent(nextPath || "index.html");
        window.location.href = "login.html?next=" + next;
    }

    function logout(nextPath) {
        clearToken();
        window.location.href = nextPath || "login.html";
    }

    window.StayAuth = {
        getToken: getToken,
        setToken: setToken,
        clearToken: clearToken,
        login: login,
        register: register,
        getMe: getMe,
        fetchWithAuth: fetchWithAuth,
        redirectToLogin: redirectToLogin,
        logout: logout
    };
})();

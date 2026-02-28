const { verifyAuthToken } = require("./jwt");

function extractBearerToken(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return null;
    }
    return authHeader.slice("Bearer ".length).trim();
}

async function requireAuth(req, usersCollection) {
    const token = extractBearerToken(req);
    if (!token) {
        return { error: "Missing bearer token", statusCode: 401 };
    }

    try {
        const payload = verifyAuthToken(token);
        const user = await usersCollection.findOne({ id: payload.sub });
        if (!user) {
            return { error: "User not found", statusCode: 401 };
        }
        return { user };
    } catch (error) {
        return { error: "Invalid or expired token", statusCode: 401 };
    }
}

module.exports = {
    requireAuth
};

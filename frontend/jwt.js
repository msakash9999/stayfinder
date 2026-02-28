const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function signAuthToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verifyAuthToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = {
    signAuthToken,
    verifyAuthToken
};

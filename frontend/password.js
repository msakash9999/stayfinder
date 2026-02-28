const crypto = require("crypto");

const HASH_ALGO = "sha512";
const KEY_LENGTH = 64;

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, HASH_ALGO).toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
    if (!storedValue || !storedValue.includes(":")) {
        return false;
    }

    const [salt, originalHash] = storedValue.split(":");
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, HASH_ALGO).toString("hex");
    const originalBuffer = Buffer.from(originalHash, "hex");
    const computedBuffer = Buffer.from(computedHash, "hex");

    if (originalBuffer.length !== computedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(originalBuffer, computedBuffer);
}

module.exports = {
    hashPassword,
    verifyPassword
};

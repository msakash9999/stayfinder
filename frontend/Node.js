const http = require("http");
const { URL } = require("url");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const { hashPassword, verifyPassword } = require("./password");
const { signAuthToken } = require("./jwt");
const { requireAuth } = require("./auth");
const { listUserFavorites, addUserFavorite, removeUserFavorite } = require("./favorites");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "stayfinder";
const DEFAULT_USER_NAME = process.env.DEFAULT_USER_NAME || "Test User";
const DEFAULT_USER_EMAIL = (process.env.DEFAULT_USER_EMAIL || "test@stayfinder.app").toLowerCase();
const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "test123";

const seedProperties = [
    {
        id: "p1",
        title: "1 BHK Flat in Patliputra Colony, Patna",
        type: "1 BHK",
        price: 18000,
        areaSqft: 1000,
        furnishing: "Fully furnished",
        location: "Patliputra Garden, Patna",
        highlights: "Lift, Natural Light, 24x7 Security",
        image: "https://dyimg1.realestateindia.com/prop_images/3075992/1174334_1-350x350.jpg",
        updatedAt: "Updated 3w ago"
    },
    {
        id: "p2",
        title: "2 BHK Flat in Rajendra Nagar, Patna",
        type: "2 BHK",
        price: 16500,
        areaSqft: 1250,
        furnishing: "Semi furnished",
        location: "Rajendra Nagar, Patna",
        highlights: "Balcony, Lift, 24x7 Water Supply",
        image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=80",
        updatedAt: "Updated 2d ago"
    },
    {
        id: "p3",
        title: "2 BHK House in Bailey Road, Patna",
        type: "2 BHK",
        price: 20000,
        areaSqft: 1400,
        furnishing: "Fully furnished",
        location: "Bailey Road, Patna",
        highlights: "Parking, Power Backup, Family Friendly",
        image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
        updatedAt: "Updated 1d ago"
    }
];

const client = new MongoClient(MONGO_URI);
let db;
let propertiesCollection;
let favoritesCollection;
let contactsCollection;
let usersCollection;

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end(JSON.stringify(payload));
}

function notFound(res) {
    sendJson(res, 404, { error: "Route not found" });
}

function stripMongoId(doc) {
    if (!doc) {
        return doc;
    }
    const { _id, ...clean } = doc;
    return clean;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => {
            data += chunk;
            if (data.length > 1e6) {
                req.socket.destroy();
                reject(new Error("Payload too large"));
            }
        });
        req.on("end", () => {
            if (!data) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(data));
            } catch (err) {
                reject(new Error("Invalid JSON"));
            }
        });
        req.on("error", reject);
    });
}

async function seedIfNeeded() {
    const propertyCount = await propertiesCollection.countDocuments();
    if (propertyCount === 0) {
        await propertiesCollection.insertMany(seedProperties);
    }
}

async function seedDefaultUserIfNeeded() {
    const existingUser = await usersCollection.findOne({ email: DEFAULT_USER_EMAIL });
    if (existingUser) {
        return;
    }

    const user = {
        id: `u_seed_${Date.now()}`,
        name: DEFAULT_USER_NAME,
        email: DEFAULT_USER_EMAIL,
        passwordHash: hashPassword(DEFAULT_USER_PASSWORD),
        createdAt: new Date().toISOString()
    };
    await usersCollection.insertOne(user);
}

async function connectDatabase() {
    await client.connect();
    db = client.db(DB_NAME);
    propertiesCollection = db.collection("properties");
    favoritesCollection = db.collection("favorites");
    contactsCollection = db.collection("contact_requests");
    usersCollection = db.collection("users");

    await propertiesCollection.createIndex({ id: 1 }, { unique: true });
    await favoritesCollection.createIndex({ userId: 1, propertyId: 1 }, { unique: true });
    await contactsCollection.createIndex({ createdAt: -1 });
    await usersCollection.createIndex({ id: 1 }, { unique: true });
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await seedIfNeeded();
    await seedDefaultUserIfNeeded();
}

const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname, searchParams } = url;

    try {
        if (req.method === "GET" && pathname === "/api/health") {
            sendJson(res, 200, {
                ok: true,
                service: "StayFinder API",
                db: DB_NAME,
                time: new Date().toISOString()
            });
            return;
        }

        if (req.method === "POST" && pathname === "/api/auth/register") {
            const body = await readBody(req);
            const name = String(body.name || "").trim();
            const email = String(body.email || "").trim().toLowerCase();
            const password = String(body.password || "");

            if (!name || !email || !password) {
                sendJson(res, 400, { error: "name, email, password are required" });
                return;
            }
            if (password.length < 6) {
                sendJson(res, 400, { error: "password must be at least 6 characters" });
                return;
            }

            const existingUser = await usersCollection.findOne({ email: email });
            if (existingUser) {
                sendJson(res, 409, { error: "email already registered" });
                return;
            }

            const user = {
                id: `u${Date.now()}`,
                name: name,
                email: email,
                passwordHash: hashPassword(password),
                createdAt: new Date().toISOString()
            };
            await usersCollection.insertOne(user);

            const token = signAuthToken(user);
            sendJson(res, 201, {
                message: "registered",
                token: token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });
            return;
        }

        if (req.method === "POST" && pathname === "/api/auth/login") {
            const body = await readBody(req);
            const email = String(body.email || "").trim().toLowerCase();
            const password = String(body.password || "");

            if (!email || !password) {
                sendJson(res, 400, { error: "email and password are required" });
                return;
            }

            const user = await usersCollection.findOne({ email: email });
            if (!user || !verifyPassword(password, user.passwordHash)) {
                sendJson(res, 401, { error: "invalid credentials" });
                return;
            }

            const token = signAuthToken(user);
            sendJson(res, 200, {
                message: "logged in",
                token: token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });
            return;
        }

        if (req.method === "GET" && pathname === "/api/auth/me") {
            const authResult = await requireAuth(req, usersCollection);
            if (authResult.error) {
                sendJson(res, authResult.statusCode, { error: authResult.error });
                return;
            }

            const user = authResult.user;
            sendJson(res, 200, {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });
            return;
        }

        if (req.method === "GET" && pathname === "/api/properties") {
            const bhk = searchParams.get("bhk");
            const maxPrice = Number(searchParams.get("maxPrice"));
            const filter = {};

            if (bhk) {
                filter.type = bhk;
            }
            if (!Number.isNaN(maxPrice) && maxPrice > 0) {
                filter.price = { $lte: maxPrice };
            }

            const result = await propertiesCollection.find(filter).toArray();
            const data = result.map(stripMongoId);
            sendJson(res, 200, { total: data.length, data });
            return;
        }

        if (req.method === "GET" && pathname.startsWith("/api/properties/")) {
            const id = pathname.split("/").pop();
            const property = await propertiesCollection.findOne({ id: id });
            if (!property) {
                sendJson(res, 404, { error: "Property not found" });
                return;
            }
            sendJson(res, 200, stripMongoId(property));
            return;
        }

        if (req.method === "GET" && pathname === "/api/favorites") {
            const authResult = await requireAuth(req, usersCollection);
            if (authResult.error) {
                sendJson(res, authResult.statusCode, { error: authResult.error });
                return;
            }
            const data = await listUserFavorites({
                favoritesCollection,
                propertiesCollection,
                userId: authResult.user.id
            });
            sendJson(res, 200, { total: data.length, data });
            return;
        }

        if (req.method === "POST" && pathname === "/api/favorites") {
            const authResult = await requireAuth(req, usersCollection);
            if (authResult.error) {
                sendJson(res, authResult.statusCode, { error: authResult.error });
                return;
            }

            const body = await readBody(req);
            const propertyId = body.propertyId;
            if (!propertyId) {
                sendJson(res, 400, { error: "propertyId is required" });
                return;
            }

            const result = await addUserFavorite({
                favoritesCollection,
                propertiesCollection,
                userId: authResult.user.id,
                propertyId: propertyId
            });
            if (result.error) {
                sendJson(res, result.statusCode, { error: result.error });
                return;
            }

            sendJson(res, 201, { message: "Added to favorites", propertyId });
            return;
        }

        if (req.method === "DELETE" && pathname.startsWith("/api/favorites/")) {
            const authResult = await requireAuth(req, usersCollection);
            if (authResult.error) {
                sendJson(res, authResult.statusCode, { error: authResult.error });
                return;
            }

            const propertyId = pathname.split("/").pop();
            await removeUserFavorite({
                favoritesCollection,
                userId: authResult.user.id,
                propertyId: propertyId
            });
            sendJson(res, 200, { message: "Removed from favorites", propertyId });
            return;
        }

        if (req.method === "POST" && pathname === "/api/contact-request") {
            const body = await readBody(req);
            const { name, phone, propertyId } = body;

            if (!name || !phone || !propertyId) {
                sendJson(res, 400, { error: "name, phone and propertyId are required" });
                return;
            }

            const property = await propertiesCollection.findOne({ id: propertyId });
            if (!property) {
                sendJson(res, 400, { error: "Invalid propertyId" });
                return;
            }

            const request = {
                id: `c${Date.now()}`,
                name: String(name).trim(),
                phone: String(phone).trim(),
                propertyId: propertyId,
                createdAt: new Date().toISOString()
            };

            await contactsCollection.insertOne(request);
            sendJson(res, 201, { message: "Contact request submitted", data: request });
            return;
        }

        if (req.method === "GET" && pathname === "/api/contact-request") {
            const results = await contactsCollection.find({}).sort({ createdAt: -1 }).toArray();
            const data = results.map(stripMongoId);
            sendJson(res, 200, { total: data.length, data });
            return;
        }

        notFound(res);
    } catch (err) {
        sendJson(res, 400, { error: err.message || "Bad request" });
    }
});

connectDatabase()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`StayFinder API running on http://localhost:${PORT}`);
            console.log(`MongoDB connected: ${MONGO_URI} (db: ${DB_NAME})`);
            console.log(`Default login: ${DEFAULT_USER_EMAIL} / ${DEFAULT_USER_PASSWORD}`);
        });
    })
    .catch((error) => {
        console.error("Failed to connect MongoDB:", error.message);
        process.exit(1);
    });

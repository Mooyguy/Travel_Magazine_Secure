// Core dependencies for server, sessions, database, and hashing
const path = require("path");
const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
require("dotenv").config();

// App + runtime configuration
const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data.db");

// SQLite connection
const db = new sqlite3.Database(DB_PATH);

// Parse JSON/form requests and set up sessions
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    session({
        secret: process.env.SESSION_SECRET || "dev-secret-change-me",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 2
        }
    })
);

// Serve static frontend files (index.html, admin.html, assets)
app.use(express.static(__dirname));

// Phone format validation: +CCC-123-123-1234
const phoneRegex = /^\+\d{1,3}-\d{3}-\d{3}-\d{4}$/;

// Create database tables and seed the default admin
const initializeDatabase = () => {
    db.serialize(() => {
        db.run(
            `CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        sex TEXT NOT NULL,
        phone TEXT NOT NULL,
                email TEXT NOT NULL,
        destination TEXT NOT NULL,
                city TEXT NOT NULL,
        persons INTEGER NOT NULL,
        travel_time TEXT NOT NULL,
        message TEXT,
        created_at TEXT NOT NULL
      )`
        );

        // Ensure existing databases include the city column
        db.run("ALTER TABLE registrations ADD COLUMN city TEXT NOT NULL DEFAULT ''", () => undefined);
        // Ensure existing databases include the email column
        db.run("ALTER TABLE registrations ADD COLUMN email TEXT NOT NULL DEFAULT ''", () => undefined);

        db.run(
            `CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      )`
        );

        ensureDefaultAdmin();
    });
};

// Create a default admin user if none exists yet
const ensureDefaultAdmin = () => {
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    db.get("SELECT id FROM admins WHERE username = ?", [adminUsername], (err, row) => {
        if (err) {
            console.error("Admin lookup failed", err);
            return;
        }
        if (!row) {
            bcrypt.hash(adminPassword, 10, (hashErr, hash) => {
                if (hashErr) {
                    console.error("Admin hash failed", hashErr);
                    return;
                }
                db.run(
                    "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
                    [adminUsername, hash],
                    (insertErr) => {
                        if (insertErr) {
                            console.error("Admin insert failed", insertErr);
                        } else {
                            console.log("Default admin created.");
                        }
                    }
                );
            });
        }
    });
};

// Middleware that protects admin-only endpoints
const isAdmin = (req, res, next) => {
    if (req.session && req.session.adminId) {
        return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
};

// Validate all registration payload fields on the server
const validateRegistration = (payload) => {
    if (!payload) {
        return "Missing registration data.";
    }
    const { fullName, sex, phone, email, destination, city, persons, travelTime } = payload;
    if (!fullName || fullName.length < 2) {
        return "Full name is required.";
    }
    if (!sex) {
        return "Sex is required.";
    }
    if (!phoneRegex.test(phone || "")) {
        return "Phone must match +234-801-234-5678 format.";
    }
    if (!email || !String(email).includes("@")) {
        return "Email is required.";
    }
    if (!destination) {
        return "Destination is required.";
    }
    if (!city || city.length < 2) {
        return "City is required.";
    }
    const personsNumber = Number(persons);
    if (!Number.isInteger(personsNumber) || personsNumber < 1 || personsNumber > 20) {
        return "Number of persons must be between 1 and 20.";
    }
    if (!travelTime) {
        return "Travel time is required.";
    }
    return null;
};

// Public API: store a new registration
app.post("/api/registrations", (req, res) => {
    const error = validateRegistration(req.body);
    if (error) {
        return res.status(400).json({ message: error });
    }

    const {
        fullName,
        sex,
        phone,
        email,
        destination,
        city,
        persons,
        travelTime,
        message
    } = req.body;

    db.run(
        `INSERT INTO registrations
            (full_name, sex, phone, email, destination, city, persons, travel_time, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
            fullName,
            sex,
            phone,
            email,
            destination,
            city,
            Number(persons),
            travelTime,
            message || "",
            new Date().toISOString()
        ],
        function insertCallback(err) {
            if (err) {
                console.error("Registration insert failed", err);
                return res.status(500).json({ message: "Failed to save registration." });
            }
            return res.status(201).json({ message: "Saved", id: this.lastID });
        }
    );
});

// Admin login: verifies password hash and sets session
app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password required." });
    }

    db.get("SELECT id, password_hash FROM admins WHERE username = ?", [username], (err, row) => {
        if (err) {
            console.error("Admin lookup failed", err);
            return res.status(500).json({ message: "Login failed." });
        }
        if (!row) {
            return res.status(401).json({ message: "Invalid credentials." });
        }
        bcrypt.compare(password, row.password_hash, (compareErr, matches) => {
            if (compareErr) {
                console.error("Password compare failed", compareErr);
                return res.status(500).json({ message: "Login failed." });
            }
            if (!matches) {
                return res.status(401).json({ message: "Invalid credentials." });
            }
            req.session.adminId = row.id;
            req.session.username = username;
            return res.json({ message: "Logged in" });
        });
    });
});

// Admin logout: destroys session cookie
app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ message: "Logged out" });
    });
});

// Admin session check
app.get("/api/admin/me", (req, res) => {
    if (!req.session || !req.session.adminId) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    res.set("Cache-Control", "no-store");
    return res.json({ username: req.session.username });
});

// Admin-only: list all registrations
app.get("/api/admin/registrations", isAdmin, (req, res) => {
    res.set("Cache-Control", "no-store");
    db.all(
        "SELECT id, full_name, sex, phone, email, destination, city, persons, travel_time, message, created_at FROM registrations ORDER BY created_at DESC",
        [],
        (err, rows) => {
            if (err) {
                console.error("Registrations fetch failed", err);
                return res.status(500).json({ message: "Failed to fetch registrations." });
            }
            return res.json({ data: rows });
        }
    );
});

// Admin-only: fetch a single registration
app.get("/api/admin/registrations/:id", isAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ message: "Invalid id." });
    }

    res.set("Cache-Control", "no-store");
    db.get(
        "SELECT id, full_name, sex, phone, email, destination, city, persons, travel_time, message, created_at FROM registrations WHERE id = ?",
        [id],
        (err, row) => {
            if (err) {
                console.error("Registration fetch failed", err);
                return res.status(500).json({ message: "Failed to fetch registration." });
            }
            if (!row) {
                return res.status(404).json({ message: "Not found." });
            }
            return res.json({ data: row });
        }
    );
});

// Admin-only: update a registration
app.put("/api/admin/registrations/:id", isAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ message: "Invalid id." });
    }

    const error = validateRegistration(req.body);
    if (error) {
        return res.status(400).json({ message: error });
    }

    const {
        fullName,
        sex,
        phone,
        email,
        destination,
        city,
        persons,
        travelTime,
        message
    } = req.body;

    db.run(
        `UPDATE registrations
         SET full_name = ?, sex = ?, phone = ?, email = ?, destination = ?, city = ?, persons = ?, travel_time = ?, message = ?
         WHERE id = ?`,
        [
            fullName,
            sex,
            phone,
            email,
            destination,
            city,
            Number(persons),
            travelTime,
            message || "",
            id
        ],
        function updateCallback(err) {
            if (err) {
                console.error("Registration update failed", err);
                return res.status(500).json({ message: "Failed to update registration." });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: "Not found." });
            }
            return res.json({ message: "Updated" });
        }
    );
});

// Admin-only: delete a registration
app.delete("/api/admin/registrations/:id", isAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ message: "Invalid id." });
    }

    db.run("DELETE FROM registrations WHERE id = ?", [id], function deleteCallback(err) {
        if (err) {
            console.error("Registration delete failed", err);
            return res.status(500).json({ message: "Failed to delete registration." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Not found." });
        }
        return res.json({ message: "Deleted" });
    });
});

// Boot database and start the server
initializeDatabase();

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

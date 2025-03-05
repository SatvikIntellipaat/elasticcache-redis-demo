const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const Redis = require("ioredis");
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// MySQL RDS Connection Configuration
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Create Users Table if Not Exists
const createUsersTable = async () => {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    home VARCHAR(100) NOT NULL,
    town VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
    `);
        console.log('Users table ensured');
    } catch (error) {
        console.error('Error creating users table:', error);
    }
};

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: 6379,
    tls: {}, // Required for AWS ElastiCache
});

// Check connection
redis.on("connect", () => {
    console.log("✅ Redis Connected");
});

redis.on("error", (err) => {
    console.error("❌ Redis Connection Error:", err);
});


// Authentication Middleware
const authenticateToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(403).json({ message: 'Invalid token' });
    }
};

// Routes
// Serve Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Signup Route
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password, home, town, city, position } = req.body;

        // Check if user exists
        const [existingUsers] = await pool.query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, home, town, city, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, home, town, city, position]
        );

        res.status(201).json({
            message: 'User created successfully',
            userId: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
	let isCachedData = false;

        // Check Redis cache first
        const cachedUser = await redis.get(`user:${username}`);
        if (cachedUser) {
	    isCachedData = true;
            console.log("✅ Cache hit! Found user in Redis.");
            const userData = JSON.parse(cachedUser);

            // Validate password even for cached user
            const isMatch = await bcrypt.compare(password, userData.hashedPassword);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            // Return cached user data without password hash
            delete userData.hashedPassword;
	    return res.json({ ...userData, isCachedData });
            //return res.json(userData);
        }

        // Find user in database
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = users[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const userData = {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                home: user.home,
                town: user.town,
                city: user.city,
                position: user.position
            },
            hashedPassword: user.password // Store hashed password for validation
        };

        // Store user in Redis with a 1-hour expiration
        await redis.setex(`user:${username}`, 3600, JSON.stringify(userData));
        console.log("✅ User stored in Redis cache.");

        // Remove password hash before sending response
        delete userData.hashedPassword;
	res.json({ ...userData, isCachedData });
    } catch (error) {
        console.error("❌ Redis Login Error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Dashboard Route
app.get('/api/dashboard', authenticateToken, (req, res) => {
    res.json({
        message: 'Welcome to the dashboard',
        user: req.user
    });
});

// Start Server
const PORT = process.env.PORT || 3000;
createUsersTable().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

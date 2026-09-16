const express = require("express");
const router = express.Router();

const pool = require("../config/database");

// Test route
router.get("/", (req, res) => {
    res.json({
        message: "Event Platform API is running!",
    });
});

// Health check
router.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "Server is healthy",
    });
});

// Database test
router.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            status: "OK",
            message: "Database connection successful",
            time: result.rows[0].now,
        });
    } catch (error) {
        console.error("Database error:", error);

        res.status(500).json({
            status: "ERROR",
            message: "Database connection failed",
        });
    }
});

module.exports = router;
const express = require("express");
const router = express.Router();

const pool = require("../config/database");

// Get all active categories
router.get("/categories", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM categories
            WHERE status = 'ACTIVE'
            ORDER BY name ASC
        `);

        res.json({
            status: "OK",
            categories: result.rows,
        });
    } catch (error) {
        console.error("Error fetching categories:", error);

        res.status(500).json({
            status: "ERROR",
            message: "Failed to fetch categories",
        });
    }
});

module.exports = router;
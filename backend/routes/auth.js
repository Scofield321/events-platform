const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const authenticateUser = require("../middleware/auth");

// Provider registration
router.post("/providers/register", async (req, res) => {
    const {
        user_id,
        email,
        phone,
        business_name,
        location,
    } = req.body;

    try {
        // Create user profile
        await pool.query(
            `
            INSERT INTO users
                (id, email, phone, role, status)
            VALUES
                ($1, $2, $3, 'PROVIDER', 'ACTIVE')
            `,
            [user_id, email, phone],
        );

        // Create provider profile
        const providerResult = await pool.query(
            `
            INSERT INTO service_providers
                (user_id, business_name, location)
            VALUES
                ($1, $2, $3)
            RETURNING *
            `,
            [user_id, business_name, location],
        );

        res.status(201).json({
            status: "OK",
            message: "Provider profile created successfully",
            provider: providerResult.rows[0],
        });
    } catch (error) {
        console.error("Provider registration error:", error);

        res.status(500).json({
            status: "ERROR",
            message: "Failed to create provider profile",
        });
    }
});

// Get currently authenticated user
router.get(
    "/me",
    authenticateUser,
    async (req, res) => {
        try {
            const result = await pool.query(
                `
                SELECT
                    u.id,
                    u.email,
                    u.phone,
                    u.role,
                    u.status,
                    sp.id AS provider_id,
                    sp.business_name,
                    sp.description,
                    sp.location,
                    sp.address,
                    sp.website_url,
                    sp.whatsapp_number,
                    sp.instagram_url,
                    sp.facebook_url,
                    sp.tiktok_url,
                    sp.average_rating,
                    sp.review_count,
                    sp.reliability_score
                FROM users u
                LEFT JOIN service_providers sp
                    ON sp.user_id = u.id
                WHERE u.id = $1
                `,
                [req.user.id],
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: "ERROR",
                    message: "User profile not found",
                });
            }

            res.json({
                status: "OK",
                user: result.rows[0],
            });
        } catch (error) {
            console.error("Error fetching user:", error);

            res.status(500).json({
                status: "ERROR",
                message: "Failed to fetch user profile",
            });
        }
    },
);

module.exports = router;
const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const authenticateUser = require("../middleware/auth");

// Update provider profile
router.put(
    "/providers/profile",
    authenticateUser,
    async (req, res) => {
        const {
            business_name,
            phone,
            location,
            address,
            description,
            website_url,
            whatsapp_number,
            instagram_url,
            facebook_url,
            tiktok_url,
        } = req.body;

        try {
            // Update user's phone number
            await pool.query(
                `
                UPDATE users
                SET
                    phone = $1,
                    updated_at = NOW()
                WHERE id = $2
                `,
                [phone || null, req.user.id],
            );

            // Update provider profile
            const result = await pool.query(
                `
                UPDATE service_providers
                SET
                    business_name = $1,
                    location = $2,
                    address = $3,
                    description = $4,
                    website_url = $5,
                    whatsapp_number = $6,
                    instagram_url = $7,
                    facebook_url = $8,
                    tiktok_url = $9,
                    updated_at = NOW()
                WHERE user_id = $10
                RETURNING *
                `,
                [
                    business_name,
                    location || null,
                    address || null,
                    description || null,
                    website_url || null,
                    whatsapp_number || null,
                    instagram_url || null,
                    facebook_url || null,
                    tiktok_url || null,
                    req.user.id,
                ],
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: "ERROR",
                    message: "Provider profile not found",
                });
            }

            res.json({
                status: "OK",
                message: "Profile updated successfully",
                provider: result.rows[0],
            });
        } catch (error) {
            console.error("Profile update error:", error);

            res.status(500).json({
                status: "ERROR",
                message: "Failed to update profile",
            });
        }
    },
);

// Get all providers
router.get("/providers", async (req, res) => {
    const { category_id } = req.query;

    try {
        let query = `
            SELECT DISTINCT
                sp.id,
                sp.business_name,
                sp.description,
                sp.location,
                sp.address,
                sp.website_url,
                sp.whatsapp_number,
                sp.instagram_url,
                sp.facebook_url,
                sp.tiktok_url,
                u.phone,
                sp.average_rating,
                sp.review_count,
                sp.reliability_score,
                sp.verification_status,
                sp.verified_at,
                sp.profile_image_url
            FROM service_providers sp

            JOIN users u
                ON u.id = sp.user_id

            LEFT JOIN provider_services ps
                ON ps.provider_id = sp.id

            LEFT JOIN services s
                ON s.id = ps.service_id

            LEFT JOIN categories c
                ON c.id = s.category_id

            WHERE u.status = 'ACTIVE'
        `;

        const values = [];

        // Filter by category
        if (category_id) {
            values.push(category_id);

            query += `
                AND c.id = $1
            `;
        }

        query += `
            ORDER BY sp.business_name
        `;

        const providerResult = await pool.query(
            query,
            values,
        );

        const providers = providerResult.rows;

        // Load services and media for each provider
        for (const provider of providers) {
            const servicesResult = await pool.query(
                `
                SELECT
                    s.id,
                    s.name,
                    c.name AS category_name
                FROM provider_services ps

                JOIN services s
                    ON s.id = ps.service_id

                JOIN categories c
                    ON c.id = s.category_id

                WHERE ps.provider_id = $1

                AND s.status = 'ACTIVE'

                AND c.status = 'ACTIVE'

                ORDER BY c.name, s.name
                `,
                [provider.id],
            );

            provider.services = servicesResult.rows;

            // Load provider media
            const mediaResult = await pool.query(
                `
                SELECT
                    id,
                    media_type,
                    media_url,
                    display_order
                FROM provider_media

                WHERE provider_id = $1

                ORDER BY display_order, created_at
                `,
                [provider.id],
            );

            provider.media = mediaResult.rows;

            // Get first uploaded image as cover image
            const firstImage = mediaResult.rows.find(
                media => media.media_type === "IMAGE"
            );

            provider.cover_image = firstImage
                ? firstImage.media_url
                : null;
        }

        res.json({
            status: "OK",
            providers,
        });
    } catch (error) {
        console.error("Error fetching providers:", error);

        res.status(500).json({
            status: "ERROR",
            message: "Failed to fetch providers",
        });
    }
});

// Get a single public provider profile
router.get("/providers/:id", async (req, res) => {
    const providerId = req.params.id;

    try {
        // Get provider profile
        const providerResult = await pool.query(
            `
            SELECT
                sp.id,
                sp.business_name,
                sp.description,
                sp.location,
                sp.address,
                sp.website_url,
                sp.profile_image_url,
                sp.whatsapp_number,
                sp.instagram_url,
                sp.facebook_url,
                sp.tiktok_url,
                u.phone,
                sp.average_rating,
                sp.review_count,
                sp.reliability_score,
                sp.verification_status,
                sp.verified_at
            FROM service_providers sp
            JOIN users u
                ON u.id = sp.user_id
            WHERE sp.id = $1
            `,
            [providerId],
        );

        if (providerResult.rows.length === 0) {
            return res.status(404).json({
                status: "ERROR",
                message: "Provider not found",
            });
        }

        const provider = providerResult.rows[0];

        // Get provider services
        const servicesResult = await pool.query(
            `
            SELECT
                s.id,
                s.name,
                s.description,
                c.id AS category_id,
                c.name AS category_name
            FROM provider_services ps
            JOIN services s
                ON s.id = ps.service_id
            JOIN categories c
                ON c.id = s.category_id
            WHERE ps.provider_id = $1
            AND s.status = 'ACTIVE'
            AND c.status = 'ACTIVE'
            ORDER BY c.name, s.name
            `,
            [providerId],
        );

        // Get provider media
        const mediaResult = await pool.query(
            `
            SELECT
                id,
                media_type,
                media_url,
                display_order
            FROM provider_media
            WHERE provider_id = $1
            ORDER BY display_order, created_at
            `,
            [providerId],
        );

        res.json({
            status: "OK",
            provider: {
                ...provider,
                services: servicesResult.rows,
                media: mediaResult.rows,
            },
        });
    } catch (error) {
        console.error(
            "Error fetching public provider:",
            error,
        );

        res.status(500).json({
            status: "ERROR",
            message: "Failed to fetch provider",
        });
    }
});

module.exports = router;
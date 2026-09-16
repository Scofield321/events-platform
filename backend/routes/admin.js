const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const authenticateUser = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");
const requireClient = require("../middleware/client");

// GET 
router.get(
    "/admin/providers/:id",
    authenticateUser,
    requireAdmin,
    async (req, res) => {
        const providerId = req.params.id;

        try {
            const providerResult = await pool.query(
                `
                SELECT
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
                    sp.verified_at
                FROM service_providers sp
                JOIN users u
                    ON u.id = sp.user_id
                WHERE sp.id = $1
                `,
                [providerId]
            );

            if (providerResult.rows.length === 0) {
                return res.status(404).json({
                    status: "ERROR",
                    message: "Provider not found"
                });
            }

            const provider = providerResult.rows[0];

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
                [providerId]
            );

            const mediaResult = await pool.query(
                `
                SELECT
                    id,
                    media_type,
                    media_url,
                    display_order,
                    created_at
                FROM provider_media
                WHERE provider_id = $1
                ORDER BY display_order, created_at
                `,
                [providerId]
            );

            res.json({
                status: "OK",
                provider: {
                    ...provider,
                    services: servicesResult.rows,
                    media: mediaResult.rows
                }
            });

        } catch (error) {

            console.error(
                "Admin provider details error:",
                error
            );

            res.status(500).json({
                status: "ERROR",
                message:
                    "Failed to load provider details"
            });
        }
    }
);

// Update provider verification
router.put(
    "/admin/providers/:id/verification",
    authenticateUser,
    requireAdmin,
    async (req, res) => {
        const providerId = req.params.id;

        const { verification_status } = req.body;

        if (
            verification_status !== "VERIFIED" &&
            verification_status !== "UNVERIFIED"
        ) {
            return res.status(400).json({
                status: "ERROR",
                message:
                    "Verification status must be VERIFIED or UNVERIFIED",
            });
        }

        try {
            const result = await pool.query(
                `
                UPDATE service_providers
                SET
                    verification_status = $1,
                    verified_at =
                        CASE
                            WHEN $1 = 'VERIFIED'
                            THEN NOW()
                            ELSE NULL
                        END,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING
                    id,
                    business_name,
                    verification_status,
                    verified_at
                `,
                [
                    verification_status,
                    providerId,
                ],
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: "ERROR",
                    message: "Provider not found",
                });
            }

            res.json({
                status: "OK",
                message:
                    verification_status === "VERIFIED"
                        ? "Provider verified successfully"
                        : "Provider verification removed",
                provider: result.rows[0],
            });
        } catch (error) {
            console.error(
                "Provider verification error:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message:
                    "Failed to update provider verification",
            });
        }
    },
);

// Client authorization test
router.get(
    "/client-test",
    authenticateUser,
    requireClient,
    (req, res) => {
        res.json({
            status: "OK",
            message:
                "Client authorization successful",
            user_id: req.user.id,
        });
    },
);

module.exports = router;
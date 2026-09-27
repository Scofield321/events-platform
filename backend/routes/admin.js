const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const supabaseAdmin = require("../config/supabaseAdmin");

const authenticateUser = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");
const requireClient = require("../middleware/client");

const calculateReliabilityScore = require("../utils/reputation");

// ==========================================================
// GET PROVIDER DETAILS
// ==========================================================

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
                    sp.user_id,
                    sp.business_name,
                    sp.description,
                    sp.location,
                    sp.address,
                    sp.website_url,
                    sp.whatsapp_number,
                    sp.instagram_url,
                    sp.facebook_url,
                    sp.tiktok_url,
                    sp.youtube_url,
                    sp.profile_image_url,

                    u.phone,
                    u.email,
                    u.status AS account_status,

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

            // --------------------------------------------------
            // SERVICES
            // --------------------------------------------------

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

            // --------------------------------------------------
            // MEDIA
            // --------------------------------------------------

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
                "Admin provider details error:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message: "Failed to load provider details",
            });
        }
    },
);

// ==========================================================
// UPDATE PROVIDER VERIFICATION
// ==========================================================

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
                    verification_status = $1::VARCHAR,

                    verified_at =
                        CASE
                            WHEN $1::VARCHAR = 'VERIFIED'
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
                [verification_status, providerId],
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: "ERROR",
                    message: "Provider not found",
                });
            }

            // Recalculate reliability because verification
            // contributes to the provider reliability score.
            const reliabilityScore =
                await calculateReliabilityScore(providerId);

            res.json({
                status: "OK",

                message:
                    verification_status === "VERIFIED"
                        ? "Provider verified successfully"
                        : "Provider verification removed",

                provider: result.rows[0],

                reliability_score: reliabilityScore,
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

// ==========================================================
// SUSPEND PROVIDER
// ==========================================================

router.put(
    "/admin/providers/:id/suspend",
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
                    sp.user_id

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

            await pool.query(
                `
                UPDATE users

                SET
                    status = 'SUSPENDED',
                    updated_at = NOW()

                WHERE id = $1
                `,
                [provider.user_id],
            );

            res.json({
                status: "OK",

                message:
                    "Provider account suspended successfully",

                provider: {
                    id: provider.id,
                    business_name: provider.business_name,
                    account_status: "SUSPENDED",
                },
            });
        } catch (error) {
            console.error(
                "Provider suspension error:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message:
                    "Failed to suspend provider account",
            });
        }
    },
);

// ==========================================================
// ACTIVATE PROVIDER
// ==========================================================

router.put(
    "/admin/providers/:id/activate",
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
                    sp.user_id

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

            await pool.query(
                `
                UPDATE users

                SET
                    status = 'ACTIVE',
                    updated_at = NOW()

                WHERE id = $1
                `,
                [provider.user_id],
            );

            res.json({
                status: "OK",

                message:
                    "Provider account activated successfully",

                provider: {
                    id: provider.id,
                    business_name: provider.business_name,
                    account_status: "ACTIVE",
                },
            });
        } catch (error) {
            console.error(
                "Provider activation error:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message:
                    "Failed to activate provider account",
            });
        }
    },
);

// ==========================================================
// DELETE PROVIDER ACCOUNT
// ==========================================================

router.delete(
    "/admin/providers/:id",
    authenticateUser,
    requireAdmin,
    async (req, res) => {
        const providerId = req.params.id;

        try {
            // --------------------------------------------------
            // 1. Find provider and linked user
            // --------------------------------------------------

            const providerResult = await pool.query(
                `
                SELECT
                    sp.id,
                    sp.user_id,
                    sp.business_name,
                    u.email

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

            // --------------------------------------------------
            // 2. Delete Supabase Auth account
            // --------------------------------------------------

            const {
                error: authDeleteError,
            } = await supabaseAdmin.auth.admin.deleteUser(
                provider.user_id,
            );

            if (authDeleteError) {
                console.error(
                    "Supabase Auth deletion error:",
                    authDeleteError,
                );

                return res.status(500).json({
                    status: "ERROR",
                    message:
                        "Failed to delete provider authentication account",
                });
            }

            // --------------------------------------------------
            // 3. Delete application database records
            // --------------------------------------------------

            const client = await pool.connect();

            try {
                await client.query("BEGIN");

                // Reviews belonging to this provider.
                await client.query(
                    `
                    DELETE FROM reviews
                    WHERE provider_id = $1
                    `,
                    [providerId],
                );

                // Provider services.
                await client.query(
                    `
                    DELETE FROM provider_services
                    WHERE provider_id = $1
                    `,
                    [providerId],
                );

                // Provider media records.
                await client.query(
                    `
                    DELETE FROM provider_media
                    WHERE provider_id = $1
                    `,
                    [providerId],
                );

                // Provider profile.
                await client.query(
                    `
                    DELETE FROM service_providers
                    WHERE id = $1
                    `,
                    [providerId],
                );

                // Local application user record.
                await client.query(
                    `
                    DELETE FROM users
                    WHERE id = $1
                    `,
                    [provider.user_id],
                );

                await client.query("COMMIT");
            } catch (dbError) {
                await client.query("ROLLBACK");

                console.error(
                    "Provider database deletion error:",
                    dbError,
                );

                return res.status(500).json({
                    status: "ERROR",
                    message:
                        "Authentication account was deleted, but provider database data could not be fully removed. Please check the database.",
                });
            } finally {
                client.release();
            }

            res.json({
                status: "OK",

                message:
                    "Provider account deleted permanently",

                provider: {
                    id: provider.id,
                    business_name: provider.business_name,
                },
            });
        } catch (error) {
            console.error(
                "Provider deletion error:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message:
                    "Failed to delete provider account",
            });
        }
    },
);

// ==========================================================
// CLIENT AUTHORIZATION TEST
// ==========================================================

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
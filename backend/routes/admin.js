const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const supabaseAdmin = require("../config/supabaseAdmin");

const authenticateUser = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");
const requireClient = require("../middleware/client");

// ==========================================================
// GET ALL PROVIDERS FOR ADMIN DASHBOARD
// ==========================================================

router.get(
    "/admin/providers",
    authenticateUser,
    requireAdmin,
    async (req, res) => {
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
                    u.suspension_reason,
                    u.suspended_until,

                    sp.average_rating,
                    sp.review_count,
                    sp.verification_status,
                    sp.verified_at

                FROM service_providers sp

                JOIN users u
                    ON u.id = sp.user_id

                ORDER BY sp.business_name
                `,
            );

            // Load services for each provider
            for (const provider of providerResult.rows) {
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
                    [provider.id],
                );

                provider.services = servicesResult.rows;
            }

            res.json({
                status: "OK",
                providers: providerResult.rows,
            });
        } catch (error) {
            console.error(
                "Admin providers error:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message: "Failed to load admin providers",
            });
        }
    },
);

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
                    u.suspension_reason,
                    u.suspended_until,

                    sp.average_rating,
                    sp.review_count,
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

// ==========================================================
// SUSPEND PROVIDER
// ==========================================================

router.put(
    "/admin/providers/:id/suspend",
    authenticateUser,
    requireAdmin,
    async (req, res) => {
        const providerId = req.params.id;

        const {
            suspension_reason,
            suspended_until,
        } = req.body || {};

        // --------------------------------------------------
        // Validate reason
        // --------------------------------------------------

        if (
            !suspension_reason ||
            !suspension_reason.trim()
        ) {
            return res.status(400).json({
                status: "ERROR",
                message:
                    "A suspension reason is required.",
            });
        }

        // --------------------------------------------------
        // Validate suspension date
        // --------------------------------------------------

        if (!suspended_until) {
            return res.status(400).json({
                status: "ERROR",
                message:
                    "A suspension end date is required.",
            });
        }

        const suspensionDate = new Date(suspended_until);

        if (Number.isNaN(suspensionDate.getTime())) {
            return res.status(400).json({
                status: "ERROR",
                message:
                    "Invalid suspension end date.",
            });
        }

        if (suspensionDate <= new Date()) {
            return res.status(400).json({
                status: "ERROR",
                message:
                    "Suspension end date must be in the future.",
            });
        }

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

            // --------------------------------------------------
            // Suspend account
            // --------------------------------------------------

            await pool.query(
                `
                UPDATE users

                SET
                    status = 'SUSPENDED',
                    suspension_reason = $1,
                    suspended_until = $2,
                    updated_at = NOW()

                WHERE id = $3
                `,
                [
                    suspension_reason.trim(),
                    suspensionDate,
                    provider.user_id,
                ],
            );

            res.json({
                status: "OK",

                message:
                    "Provider account suspended successfully",

                provider: {
                    id: provider.id,
                    business_name: provider.business_name,
                    account_status: "SUSPENDED",
                    suspension_reason:
                        suspension_reason.trim(),
                    suspended_until:
                        suspensionDate.toISOString(),
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
            // --------------------------------------------------
            // Find provider
            // --------------------------------------------------

            const providerResult = await pool.query(
                `
                SELECT
                    sp.id,
                    sp.business_name,
                    sp.user_id,
                    u.status AS current_status

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
            // ADMIN OVERRIDE
            // Reactivate account immediately
            // regardless of suspended_until date
            // --------------------------------------------------

            const activationResult = await pool.query(
                `
                UPDATE users

                SET
                    status = 'ACTIVE',
                    suspension_reason = NULL,
                    suspended_until = NULL,
                    updated_at = NOW()

                WHERE id = $1

                RETURNING
                    id,
                    status,
                    suspension_reason,
                    suspended_until,
                    updated_at
                `,
                [provider.user_id],
            );

            if (activationResult.rows.length === 0) {
                return res.status(500).json({
                    status: "ERROR",
                    message:
                        "Provider account could not be activated.",
                });
            }

            const activatedAccount =
                activationResult.rows[0];

            // --------------------------------------------------
            // Confirm activation actually happened
            // --------------------------------------------------

            if (activatedAccount.status !== "ACTIVE") {
                return res.status(500).json({
                    status: "ERROR",
                    message:
                        "Account activation was not completed.",
                });
            }

            // --------------------------------------------------
            // Success
            // --------------------------------------------------

            res.json({
                status: "OK",

                message:
                    "Provider account activated successfully by admin.",

                provider: {
                    id: provider.id,
                    business_name: provider.business_name,
                    previous_status:
                        provider.current_status,
                    account_status:
                        activatedAccount.status,
                    suspension_reason:
                        activatedAccount.suspension_reason,
                    suspended_until:
                        activatedAccount.suspended_until,
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
            // Delete Supabase Auth account
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
            // Delete application database records
            // --------------------------------------------------

            const client = await pool.connect();

            try {
                await client.query("BEGIN");

                await client.query(
                    `
                    DELETE FROM reviews
                    WHERE provider_id = $1
                    `,
                    [providerId],
                );

                await client.query(
                    `
                    DELETE FROM provider_services
                    WHERE provider_id = $1
                    `,
                    [providerId],
                );

                await client.query(
                    `
                    DELETE FROM provider_media
                    WHERE provider_id = $1
                    `,
                    [providerId],
                );

                await client.query(
                    `
                    DELETE FROM service_providers
                    WHERE id = $1
                    `,
                    [providerId],
                );

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
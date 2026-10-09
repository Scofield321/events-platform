
const express = require("express");
const pool = require("../config/database");
const authenticateUser = require("../middleware/auth");

const router = express.Router();

const VALID_STATUSES = [
    "NEW",
    "CONTACTED",
    "QUOTING",
    "AWAITING_CLIENT",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
    "DECLINED",
];

function requireAdmin(req, res, next) {
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({
            status: "ERROR",
            message: "Administrator access required.",
        });
    }

    next();
}

// PUBLIC: Submit a quote request for a provider.
router.post("/inquiries", async (req, res) => {
    try {
        const {
            provider_id,
            client_name,
            client_phone,
            client_email,
            event_type,
            event_date,
            event_location,
            budget_range,
            requirements,
        } = req.body || {};

        const requiredFields = {
            provider_id,
            client_name,
            client_phone,
            event_type,
            event_date,
            event_location,
            requirements,
        };

        for (const [field, value] of Object.entries(requiredFields)) {
            if (typeof value !== "string" || !value.trim()) {
                return res.status(400).json({
                    status: "ERROR",
                    message: `${field} is required.`,
                });
            }
        }

        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidPattern.test(provider_id)) {
            return res.status(400).json({
                status: "ERROR",
                message: "Invalid provider ID.",
            });
        }

        if (
            client_name.trim().length > 120 ||
            client_phone.trim().length > 30 ||
            event_type.trim().length > 100 ||
            event_location.trim().length > 200 ||
            requirements.trim().length > 3000
        ) {
            return res.status(400).json({
                status: "ERROR",
                message: "One or more fields exceed the allowed length.",
            });
        }

        if (
            client_email != null &&
            (typeof client_email !== "string" ||
                client_email.length > 254)
        ) {
            return res.status(400).json({
                status: "ERROR",
                message: "Invalid email address.",
            });
        }

        if (
            client_email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email.trim())
        ) {
            return res.status(400).json({
                status: "ERROR",
                message: "Invalid email address.",
            });
        }

        if (budget_range != null &&
            (typeof budget_range !== "string" || budget_range.length > 100)) {
            return res.status(400).json({
                status: "ERROR",
                message: "Invalid budget range.",
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
            return res.status(400).json({
                status: "ERROR",
                message: "Event date must use YYYY-MM-DD format.",
            });
        }

        const date = new Date(`${event_date}T00:00:00Z`);

        if (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== event_date
        ) {
            return res.status(400).json({
                status: "ERROR",
                message: "Invalid event date.",
            });
        }

        if (event_date < new Date().toISOString().slice(0, 10)) {
            return res.status(400).json({
                status: "ERROR",
                message: "Event date cannot be in the past.",
            });
        }

        const providerResult = await pool.query(
            `SELECT id
             FROM service_providers
             WHERE id = $1`,
            [provider_id]
        );

        if (providerResult.rows.length === 0) {
            return res.status(404).json({
                status: "ERROR",
                message: "Provider not found.",
            });
        }

        const result = await pool.query(
            `INSERT INTO booking_inquiries (
                provider_id,
                client_name,
                client_phone,
                client_email,
                event_type,
                event_date,
                event_location,
                budget_range,
                requirements
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, status, created_at`,
            [
                provider_id,
                client_name.trim(),
                client_phone.trim(),
                client_email ? client_email.trim() : null,
                event_type.trim(),
                event_date,
                event_location.trim(),
                budget_range || null,
                requirements.trim(),
            ]
        );

        return res.status(201).json({
            status: "SUCCESS",
            message: "Your quote request has been received by Bide Hub.",
            inquiry: result.rows[0],
        });
    } catch (error) {
        console.error("Quote request submission failed:", error.message);

        return res.status(500).json({
            status: "ERROR",
            message: "Unable to submit your request right now.",
        });
    }
});

// ADMIN: List inquiries.
router.get(
    "/admin/inquiries",
    authenticateUser,
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    i.*,
                    sp.business_name,
                    sp.location AS provider_location
                 FROM booking_inquiries i
                 JOIN service_providers sp ON sp.id = i.provider_id
                 ORDER BY i.created_at DESC
                 LIMIT 200`
            );

            return res.json({
                status: "SUCCESS",
                inquiries: result.rows,
            });
        } catch (error) {
            console.error("Loading inquiries failed:", error.message);

            return res.status(500).json({
                status: "ERROR",
                message: "Unable to load inquiries.",
            });
        }
    }
);

// ADMIN: Update inquiry status and negotiated amounts.
router.patch(
    "/admin/inquiries/:id",
    authenticateUser,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const {
                status,
                quoted_amount,
                provider_amount,
                bidehub_commission,
                admin_notes,
            } = req.body || {};

            const uuidPattern =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            if (!uuidPattern.test(id)) {
                return res.status(400).json({
                    status: "ERROR",
                    message: "Invalid inquiry ID.",
                });
            }

            if (status !== undefined && !VALID_STATUSES.includes(status)) {
                return res.status(400).json({
                    status: "ERROR",
                    message: "Invalid inquiry status.",
                });
            }

            const amountFields = {
                quoted_amount,
                provider_amount,
                bidehub_commission,
            };

            for (const [field, value] of Object.entries(amountFields)) {
                if (
                    value !== undefined &&
                    value !== null &&
                    (!Number.isFinite(Number(value)) || Number(value) < 0)
                ) {
                    return res.status(400).json({
                        status: "ERROR",
                        message: `${field} must be a non-negative number.`,
                    });
                }
            }

            if (
                quoted_amount != null &&
                provider_amount != null &&
                Number(provider_amount) > Number(quoted_amount)
            ) {
                return res.status(400).json({
                    status: "ERROR",
                    message: "Provider amount cannot exceed the client quote.",
                });
            }

            if (
                admin_notes !== undefined &&
                (typeof admin_notes !== "string" || admin_notes.length > 5000)
            ) {
                return res.status(400).json({
                    status: "ERROR",
                    message: "Admin notes must be text up to 5000 characters.",
                });
            }

            const result = await pool.query(
                `UPDATE booking_inquiries
                 SET
                    status = COALESCE($2, status),
                    quoted_amount = COALESCE($3, quoted_amount),
                    provider_amount = COALESCE($4, provider_amount),
                    bidehub_commission = COALESCE($5, bidehub_commission),
                    admin_notes = COALESCE($6, admin_notes),
                    updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [
                    id,
                    status ?? null,
                    quoted_amount ?? null,
                    provider_amount ?? null,
                    bidehub_commission ?? null,
                    admin_notes ?? null,
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    status: "ERROR",
                    message: "Inquiry not found.",
                });
            }

            return res.json({
                status: "SUCCESS",
                inquiry: result.rows[0],
            });
        } catch (error) {
            console.error("Updating inquiry failed:", error.message);

            return res.status(500).json({
                status: "ERROR",
                message: "Unable to update inquiry.",
            });
        }
    }
);

module.exports = router;
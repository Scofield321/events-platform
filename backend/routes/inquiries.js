
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


/* ADMIN: Update inquiry status and negotiated amounts.
   Omitted fields remain unchanged.
   Explicit null or an empty amount clears that field. */
router.patch(
    "/admin/inquiries/:id",
    authenticateUser,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const body = req.body || {};

            const fields = [
                "status",
                "quoted_amount",
                "provider_amount",
                "bidehub_commission",
                "admin_notes",
            ];

            const has = (field) =>
                Object.prototype.hasOwnProperty.call(body, field);

            const uuidPattern =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            if (!uuidPattern.test(id)) {
                return res.status(400).json({
                    status: "ERROR",
                    message: "Invalid inquiry ID.",
                });
            }

            if (!fields.some(has)) {
                return res.status(400).json({
                    status: "ERROR",
                    message: "No inquiry fields were provided.",
                });
            }

            if (has("status") &&
                !VALID_STATUSES.includes(body.status)) {
                return res.status(400).json({
                    status: "ERROR",
                    message: "Invalid inquiry status.",
                });
            }

            const amountFields = [
                "quoted_amount",
                "provider_amount",
                "bidehub_commission",
            ];

            for (const field of amountFields) {
                if (!has(field) || body[field] === null ||
                    body[field] === "") {
                    continue;
                }

                const value = body[field];

                if (
                    (typeof value !== "number" &&
                        typeof value !== "string") ||
                    !Number.isFinite(Number(value)) ||
                    Number(value) < 0
                ) {
                    return res.status(400).json({
                        status: "ERROR",
                        message:
                            `${field} must be a non-negative number or empty.`,
                    });
                }
            }

            if (
                has("admin_notes") &&
                body.admin_notes !== null &&
                (typeof body.admin_notes !== "string" ||
                    body.admin_notes.length > 5000)
            ) {
                return res.status(400).json({
                    status: "ERROR",
                    message: "Admin notes must be text up to 5000 characters.",
                });
            }

            // Read existing amounts to validate the final quote and payout.
            const currentResult = await pool.query(
                `SELECT quoted_amount, provider_amount
                 FROM booking_inquiries
                 WHERE id = $1`,
                [id]
            );

            if (currentResult.rows.length === 0) {
                return res.status(404).json({
                    status: "ERROR",
                    message: "Inquiry not found.",
                });
            }

            const current = currentResult.rows[0];

            const nextQuote = has("quoted_amount")
                ? (body.quoted_amount === "" ? null : body.quoted_amount)
                : current.quoted_amount;

            const nextPayout = has("provider_amount")
                ? (body.provider_amount === "" ? null : body.provider_amount)
                : current.provider_amount;

            if (
                nextQuote != null &&
                nextPayout != null &&
                Number(nextPayout) > Number(nextQuote)
            ) {
                return res.status(400).json({
                    status: "ERROR",
                    message:
                        "Provider amount cannot exceed the client quote.",
                });
            }

            const result = await pool.query(
                `UPDATE booking_inquiries
                 SET
                    status = CASE
                        WHEN $2::boolean THEN $3::varchar
                        ELSE status
                    END,
                    quoted_amount = CASE
                        WHEN $4::boolean THEN $5::numeric
                        ELSE quoted_amount
                    END,
                    provider_amount = CASE
                        WHEN $6::boolean THEN $7::numeric
                        ELSE provider_amount
                    END,
                    bidehub_commission = CASE
                        WHEN $8::boolean THEN $9::numeric
                        ELSE bidehub_commission
                    END,
                    admin_notes = CASE
                        WHEN $10::boolean THEN $11::text
                        ELSE admin_notes
                    END,
                    updated_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [
                    id,
                    has("status"),
                    body.status ?? null,
                    has("quoted_amount"),
                    body.quoted_amount === "" ? null : body.quoted_amount ?? null,
                    has("provider_amount"),
                    body.provider_amount === "" ? null : body.provider_amount ?? null,
                    has("bidehub_commission"),
                    body.bidehub_commission === "" ? null : body.bidehub_commission ?? null,
                    has("admin_notes"),
                    body.admin_notes ?? null,
                ]
            );

            return res.json({
                status: "SUCCESS",
                inquiry: result.rows[0],
            });
        } catch (error) {
            console.error(
                "Updating inquiry failed:",
                error.message
            );

            return res.status(500).json({
                status: "ERROR",
                message: "Unable to update inquiry.",
            });
        }
    }
);

module.exports = router;
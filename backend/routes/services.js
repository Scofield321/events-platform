const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const authenticateUser = require("../middleware/auth");

// Get all available services
router.get("/services", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                s.id,
                s.name,
                s.description,
                c.id AS category_id,
                c.name AS category_name
            FROM services s
            JOIN categories c
                ON c.id = s.category_id
            WHERE s.status = 'ACTIVE'
            AND c.status = 'ACTIVE'
            ORDER BY c.name, s.name
        `);

        res.json({
            status: "OK",
            services: result.rows,
        });
    } catch (error) {
        console.error("Error fetching services:", error);

        res.status(500).json({
            status: "ERROR",
            message: "Failed to fetch services",
        });
    }
});

// Get services for the logged-in provider
router.get(
    "/providers/services",
    authenticateUser,
    async (req, res) => {
        try {
            const result = await pool.query(
                `
                SELECT
                    s.id,
                    s.name,
                    s.description,
                    c.name AS category_name
                FROM provider_services ps
                JOIN services s
                    ON s.id = ps.service_id
                JOIN categories c
                    ON c.id = s.category_id
                JOIN service_providers sp
                    ON sp.id = ps.provider_id
                WHERE sp.user_id = $1
                AND s.status = 'ACTIVE'
                ORDER BY c.name, s.name
                `,
                [req.user.id],
            );

            res.json({
                status: "OK",
                services: result.rows,
            });
        } catch (error) {
            console.error(
                "Error fetching provider services:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message: "Failed to fetch provider services",
            });
        }
    },
);

// Save services for the logged-in provider
router.post(
    "/providers/services",
    authenticateUser,
    async (req, res) => {
        const { service_ids } = req.body;

        if (!Array.isArray(service_ids)) {
            return res.status(400).json({
                status: "ERROR",
                message: "service_ids must be an array",
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Find provider
            const providerResult = await client.query(
                `
                SELECT id
                FROM service_providers
                WHERE user_id = $1
                `,
                [req.user.id],
            );

            if (providerResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    status: "ERROR",
                    message: "Provider profile not found",
                });
            }

            const providerId = providerResult.rows[0].id;

            // Remove previous services
            await client.query(
                `
                DELETE FROM provider_services
                WHERE provider_id = $1
                `,
                [providerId],
            );

            // Add selected services
            for (const serviceId of service_ids) {
                await client.query(
                    `
                    INSERT INTO provider_services
                        (provider_id, service_id)
                    VALUES
                        ($1, $2)
                    `,
                    [providerId, serviceId],
                );
            }

            await client.query("COMMIT");

            res.json({
                status: "OK",
                message: "Services saved successfully",
            });
        } catch (error) {
            await client.query("ROLLBACK");

            console.error(
                "Error saving provider services:",
                error,
            );

            res.status(500).json({
                status: "ERROR",
                message: "Failed to save services",
            });
        } finally {
            client.release();
        }
    },
);

module.exports = router;
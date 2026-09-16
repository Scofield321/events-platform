const pool = require("../config/database");

async function requireAdmin(req, res, next) {

    try {

        const result = await pool.query(
            `
            SELECT role, status
            FROM users
            WHERE id = $1
            `,
            [req.user.id]
        );

        if (result.rows.length === 0) {

            return res.status(403).json({
                status: "ERROR",
                message: "User account not found"
            });

        }

        const user = result.rows[0];

        if (user.status !== "ACTIVE") {

            return res.status(403).json({
                status: "ERROR",
                message: "User account is not active"
            });

        }

        if (user.role !== "ADMIN") {

            return res.status(403).json({
                status: "ERROR",
                message: "Admin access required"
            });

        }

        next();

    } catch (error) {

        console.error(
            "Admin authorization error:",
            error
        );

        res.status(500).json({
            status: "ERROR",
            message: "Authorization check failed"
        });

    }

}

module.exports = requireAdmin;
const pool = require("../config/database");

async function requireAdmin(req, res, next) {
    try {
        const result = await pool.query(
            `
            SELECT
                role,
                status
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

        // --------------------------------------------------
        // CHECK ADMIN ROLE FIRST
        // --------------------------------------------------

        if (user.role !== "ADMIN") {
            return res.status(403).json({
                status: "ERROR",
                message: "Admin access required"
            });
        }

        // --------------------------------------------------
        // ADMIN OVERRIDE
        // --------------------------------------------------
        //
        // An administrator must be able to access the
        // administration system even if their account
        // status is SUSPENDED.
        //
        // This prevents the suspension system from
        // locking administrators out of their own
        // control panel.
        // --------------------------------------------------

        next();

    } catch (error) {
        console.error(
            "Admin authorization error:",
            error
        );

        return res.status(500).json({
            status: "ERROR",
            message: "Authorization check failed"
        });
    }
}

module.exports = requireAdmin;
const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Route files
const healthRoutes = require("./routes/health");
const categoryRoutes = require("./routes/categories");
const serviceRoutes = require("./routes/services");
const authRoutes = require("./routes/auth");
const providerRoutes = require("./routes/providers");
const mediaRoutes = require("./routes/media");
const reviewRoutes = require("./routes/reviews");
const adminRoutes = require("./routes/admin");

const app = express();

const PORT = process.env.PORT || 3000;

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(cors());
app.use(express.json());

// =========================================================
// ROUTES
// =========================================================

app.use("/", healthRoutes);
app.use("/api", categoryRoutes);
app.use("/api", serviceRoutes);
app.use("/api", authRoutes);
app.use("/api", mediaRoutes);
app.use("/api", providerRoutes);
app.use("/api", reviewRoutes);
app.use("/api", adminRoutes);

// =========================================================
// START SERVER
// =========================================================

app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`,
    );
});
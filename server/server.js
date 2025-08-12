const express = require("express");
const prisma = require("./config/db");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const roleRoutes = require("./routes/roleRoutes");
const ticketRoutes = require("./routes/ticketRoutes");

const PORT = process.env.PORT || 4000;

async function main() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully!");
  } catch (error) {
    console.error("Failed to connect to the database");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/tickets", ticketRoutes);

require("./workers/emailWorker");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require("express");
const PORT = process.env.PORT || 4000;
const prisma = require('./config/db');
require("dotenv").config();

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully!');

  } catch (error) {
    console.error('Failed to connect to the database');
    console.error(error);
    process.exit(1); 
  } finally {
    await prisma.$disconnect();
  }
}

main();

const app = express();
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

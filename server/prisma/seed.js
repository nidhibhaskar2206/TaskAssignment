const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });

  if (existing) {
    console.log("Superuser already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash("superpassword", 10);

  const user = await prisma.user.create({
    data: {
      name: "Super Admin",
      username: "admin",
      email: "admin@example.com",
      password: hashedPassword,
      is_super: true,
      role: "super_admin", 
    },
  });
  

  console.log(`✅ Superuser created: ${user.email}`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding superuser:", e);
  })
  .finally(() => prisma.$disconnect());

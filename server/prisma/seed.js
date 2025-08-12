const { PrismaClient, UserType } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
  // Permissions data
  const entities = ["Tickets", "Comments", "Role", "UserRole"];
  const operations = ["CREATE", "READ", "UPDATE", "DELETE", "COMMENT"];

  for (const entity of entities) {
    for (const operation of operations) {
      await prisma.permission.upsert({
        where: {
          entity_operation: { entity, operation },
        },
        update: {}, 
        create: { entity, operation },
      });
    }
  }
  console.log("✅ Permissions seeded successfully.");

  // Check if SUPER_ADMIN already exists
  const existingAdmin = await prisma.users.findUnique({
    where: { email: "gauravlucifer20@gmail.com" },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("Admin@1234", 10);

    await prisma.users.create({
      data: {
        name: "ADMIN",
        email: "gauravlucifer20@gmail.com",
        password: hashedPassword,
        user_type: UserType.SUPER_ADMIN,
        is_verified: true,
        mfa_enabled: false,
      },
    });

    console.log("✅ SUPER_ADMIN user created successfully.");
  } else {
    console.log("ℹ️ SUPER_ADMIN user already exists.");
  }
}

main()
  .catch((err) => {
    console.error("❌ Error seeding data:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

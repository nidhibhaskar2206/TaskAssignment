const { PrismaClient, UserType } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
  // Permissions data
  const entities = ["TICKET", "COMMENT", "ROLE", "USER_ROLE", "ROLE_PERMISSION", "USER", "HISTORY"];
  const operations = ["CREATE", "READ", "UPDATE", "DELETE"];

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

  // SUPER_ADMIN
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

  // 3 Normal Users
  // prisma/seed.js (fixed users loop)
  const hashedUserPassword = await bcrypt.hash("User@1234", 10);
  const userData = Array.from({ length: 3 }, (_, i) => ({
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    password: hashedUserPassword,
    user_type: UserType.OTHER, // <-- use OTHER (matches your enum)
    is_verified: true,
    mfa_enabled: false,
  }));

  for (const user of userData) {
    await prisma.users.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  console.log("✅ 3 normal users seeded successfully.");
}

main()
  .catch((err) => {
    console.error("❌ Error seeding data:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

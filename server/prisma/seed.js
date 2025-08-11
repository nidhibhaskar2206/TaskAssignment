const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const entities = [
    "Workspace",
    "Tickets",
    "Comments",
    "History",
    "Role",
    "UserRole",
    "Permission",
  ];

  const operations = [
    "CREATE",
    "READ",
    "UPDATE",
    "DELETE",
    "COMMENT",
    "MANAGE",
  ];

  for (const entity of entities) {
    for (const operation of operations) {
      await prisma.permission.upsert({
        where: {
          entity_operation: {
            entity,
            operation,
          },
        },
        update: {}, // nothing to update
        create: {
          entity,
          operation,
        },
      });
    }
  }

  console.log("✅ Permissions seeded successfully.");
}

main()
  .catch((err) => {
    console.error("❌ Error seeding permissions:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

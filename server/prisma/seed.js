// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create a SUPER_ADMIN user
  const admin = await prisma.users.create({
    data: {
      name: 'Super Admin',
      email: 'admin@example.com',
      password: 'hashed_password', // Use hashed value in real app
      user_type: 'SUPER_ADMIN',
      mfa_enabled: false,
    }
  });

  // Create a Workspace with that admin
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Main Workspace',
      admin_id: admin.id,
      created_by: admin.id
    }
  });

  // Create a Role in that Workspace
  await prisma.role.create({
    data: {
      name: 'Admin',
      desc: 'Admin role for workspace',
      workspace_id: workspace.id
    }
  });

  console.log('🌱 Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL para ejecutar seed (PostgreSQL)");
}

const prisma = new PrismaClient();

async function main() {
  const seedEmail = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  if (!seedEmail) {
    throw new Error("Falta ADMIN_SEED_EMAIL para ejecutar seed");
  }

  const admin = await prisma.user.upsert({
    where: { email: seedEmail },
    update: { role: "ADMIN" },
    create: {
      email: seedEmail,
      name: "Admin inicial",
      role: "ADMIN",
    },
  });

  console.log(`Admin seed listo: ${admin.email} (${admin.id})`);
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

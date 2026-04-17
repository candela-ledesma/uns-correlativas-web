import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./prisma/dev.db";
}

const prisma = new PrismaClient();

async function main() {
  const seedEmail =
    process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase() || "admin@uns.local";

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

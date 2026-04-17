import { PrismaClient } from "@prisma/client";

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

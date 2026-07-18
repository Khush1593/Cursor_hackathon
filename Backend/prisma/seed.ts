/**
 * Demo seed — synthetic data only (no real PHI).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = 'demo@aura.health';
  const passwordHash = await bcrypt.hash('SecurePass1!', 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      age: 34,
      sex: 'female',
      chronicConditions: ['mild eczema'],
      currentMeds: ['multivitamin'],
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+1-555-0100',
      activeMode: 'preventive',
      isEmergencyState: false,
    },
  });

  await prisma.healthLog.deleteMany({ where: { userId: user.id } });

  const days = [
    { daysAgo: 3, pain: 4, sleep: 6 },
    { daysAgo: 2, pain: 5, sleep: 5 },
    { daysAgo: 1, pain: 6, sleep: 5 },
    { daysAgo: 0, pain: 3, sleep: 7 },
  ];

  for (const day of days) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - day.daysAgo);
    await prisma.healthLog.create({
      data: {
        userId: user.id,
        createdAt,
        rawAudioText: 'migraine again today',
        detectedMode: 'urgent_care',
        detectedConditionId: 'migraine_exacerbation',
        severityScore: 5,
        extractedMetrics: {
          pain_level: day.pain,
          sleep_hours: day.sleep,
        },
        aiResponseText: 'Logged your migraine symptoms for trend tracking.',
      },
    });
  }

  await prisma.consentRecord.create({
    data: {
      userId: user.id,
      consentType: 'data_collection',
      granted: true,
      version: 'v1',
    },
  });

  console.log(`Seeded demo user ${user.id} (${email}) / SecurePass1!`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Demo seed stub — implement later.
 * Must use synthetic data only (no real PHI). See project_knowledge.md §14.
 */
async function main(): Promise<void> {
  // TODO: seed demo user + 4 days of HealthLogs + consent records
  console.log('Seed not implemented yet. Scaffold only.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    // PrismaClient disconnect will be wired when seed is implemented
  });

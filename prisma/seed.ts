/**
 * PawCare seed script — run with: bun prisma/seed.ts
 * Seeds users (all roles), services, pets, 6 months of appointments,
 * payments, treatments, reviews and notifications.
 */
import { PrismaClient } from "@prisma/client";

// Imported rather than re-implemented: this file used to carry its own copy of
// the salt and hashing call, so changing one without the other would have
// silently locked every seeded account out.
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * This script deletes every row in every table before reseeding. Nothing stopped
 * it running against the production connection string, so it refuses unless the
 * target is obviously a local database or the caller opts in explicitly.
 */
function assertSafeToWipe() {
  const url = process.env.DATABASE_URL ?? "";
  const forced = process.env.SEED_FORCE === "true" || process.argv.includes("--force");
  const isLocal =
    url.startsWith("file:") || /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
  const redacted = url.replace(/\/\/[^@]*@/, "//<credentials>@").slice(0, 120) || "(DATABASE_URL not set)";

  if (process.env.NODE_ENV === "production" && !forced) {
    console.error(`\n✗ Refusing to seed: NODE_ENV=production.\n  Target: ${redacted}\n  Override with SEED_FORCE=true if this is genuinely intended.\n`);
    process.exit(1);
  }
  if (!isLocal && !forced) {
    console.error(`\n✗ Refusing to seed a remote database - this script DELETES ALL DATA first.\n  Target: ${redacted}\n  Override with SEED_FORCE=true (or --force) if this is genuinely intended.\n`);
    process.exit(1);
  }

  console.log(`⚠  Seeding (this deletes all existing data): ${redacted}`);
}

async function main() {
  assertSafeToWipe();

  console.log("🧹 Clearing existing data...");
  await db.notification.deleteMany();
  await db.review.deleteMany();
  await db.payment.deleteMany();
  await db.treatment.deleteMany();
  await db.appointment.deleteMany();
  await db.service.deleteMany();
  await db.pet.deleteMany();
  await db.user.deleteMany();
  await db.setting.deleteMany();

  console.log("👤 Creating users...");
  const admin = await db.user.create({
    data: { name: "Ayesha Rahman", email: "admin@pawcare.com", password: hashPassword("admin123"), role: "ADMIN", phone: "+880 1711-000001", bio: "Platform administrator" },
  });
  const staff = await db.user.create({
    data: { name: "Farhan Ahmed", email: "staff@pawcare.com", password: hashPassword("staff123"), role: "STAFF", phone: "+880 1711-000002", bio: "Front desk operations" },
  });
  const vet1 = await db.user.create({
    data: { name: "Dr. Nusrat Jahan", email: "vet@pawcare.com", password: hashPassword("vet123"), role: "VET", specialty: "VET", phone: "+880 1711-000003", bio: "Small animal specialist with 8 years of experience in internal medicine and surgery." },
  });
  const vet2 = await db.user.create({
    data: { name: "Dr. Tanvir Hasan", email: "tanvir.vet@pawcare.com", password: hashPassword("vet123"), role: "VET", specialty: "VET", phone: "+880 1711-000004", bio: "Feline medicine & dentistry focused veterinarian." },
  });
  const groomer = await db.user.create({
    data: { name: "Sadia Karim", email: "groomer@pawcare.com", password: hashPassword("groomer123"), role: "GROOMER", specialty: "GROOMER", phone: "+880 1711-000005", bio: "Certified pet groomer — gentle handling for anxious pets." },
  });
  const c1 = await db.user.create({
    data: { name: "Rahim Uddin", email: "customer@pawcare.com", password: hashPassword("customer123"), role: "CUSTOMER", phone: "+880 1811-000010" },
  });
  const c2 = await db.user.create({
    data: { name: "Nila Akter", email: "nila@example.com", password: hashPassword("customer123"), role: "CUSTOMER", phone: "+880 1811-000011" },
  });
  const c3 = await db.user.create({
    data: { name: "Kamal Hossain", email: "kamal@example.com", password: hashPassword("customer123"), role: "CUSTOMER", phone: "+880 1811-000012" },
  });

  console.log("⚙️  Creating settings...");
  await db.setting.create({ data: {} });

  console.log("🧼 Creating services...");
  const sConsult = await db.service.create({ data: { name: "Veterinary Consultation", category: "MEDICAL", description: "A complete health check-up by an experienced veterinarian — physical exam, vitals and personalized advice.", duration: 30, price: 800, icon: "🩺" } });
  const sVaccine = await db.service.create({ data: { name: "Vaccination", category: "MEDICAL", description: "Core vaccines for dogs and cats including rabies, DHPPi and FeLV with record keeping.", duration: 20, price: 1200, icon: "💉" } });
  const sDental = await db.service.create({ data: { name: "Dental Care", category: "MEDICAL", description: "Professional dental scaling, polishing and oral health assessment under safe sedation.", duration: 45, price: 1500, icon: "🦷" } });
  const sGroom = await db.service.create({ data: { name: "Full Grooming", category: "GROOMING", description: "Bath, blow-dry, haircut, ear cleaning and nail trim — the full spa treatment for your pet.", duration: 60, price: 1800, icon: "✂️" } });
  const sBath = await db.service.create({ data: { name: "Bath & Cleaning", category: "GROOMING", description: "Gentle bath with pet-safe shampoo, conditioning and thorough drying.", duration: 40, price: 900, icon: "🛁" } });
  const sNail = await db.service.create({ data: { name: "Nail Trimming", category: "GROOMING", description: "Quick and careful nail clipping with paw pad check and filing.", duration: 15, price: 500, icon: "🐕" } });
  const sTreatment = await db.service.create({ data: { name: "General Treatment", category: "MEDICAL", description: "Treatment for common illnesses — infections, wounds, upset stomach and more.", duration: 40, price: 1000, icon: "🏥" } });
  const sLab = await db.service.create({ data: { name: "Lab Test", category: "DIAGNOSTIC", description: "In-house blood work, urinalysis and fecal exams with fast same-day results.", duration: 30, price: 2000, icon: "🧪" } });
  const services = [sConsult, sVaccine, sDental, sGroom, sBath, sNail, sTreatment, sLab];

  console.log("🐶 Creating pets...");
  const bruno = await db.pet.create({ data: { name: "Bruno", type: "DOG", breed: "Golden Retriever", gender: "MALE", birthDate: "2021-03-14", weight: 28.5, color: "Golden", vaccinationStatus: "UP_TO_DATE", medicalNotes: "Mild skin allergy in summer — antihistamine as needed.", ownerId: c1.id } });
  const momo = await db.pet.create({ data: { name: "Momo", type: "CAT", breed: "Persian", gender: "FEMALE", birthDate: "2022-07-02", weight: 4.2, color: "White", vaccinationStatus: "PARTIAL", medicalNotes: "Indoor cat, occasional hairballs.", ownerId: c1.id } });
  const kiwi = await db.pet.create({ data: { name: "Kiwi", type: "BIRD", breed: "Budgerigar", gender: "MALE", birthDate: "2023-01-20", weight: 0.35, color: "Green & Yellow", vaccinationStatus: "NONE", ownerId: c2.id } });
  const rocky = await db.pet.create({ data: { name: "Rocky", type: "DOG", breed: "German Shepherd", gender: "MALE", birthDate: "2020-11-05", weight: 32, color: "Black & Tan", vaccinationStatus: "UP_TO_DATE", medicalNotes: "Hip dysplasia watch — joint supplements daily.", ownerId: c2.id } });
  const luna = await db.pet.create({ data: { name: "Luna", type: "CAT", breed: "Siamese", gender: "FEMALE", birthDate: "2021-09-18", weight: 3.6, color: "Cream", vaccinationStatus: "UP_TO_DATE", ownerId: c3.id } });
  const coco = await db.pet.create({ data: { name: "Coco", type: "DOG", breed: "Poodle", gender: "FEMALE", birthDate: "2022-04-25", weight: 6.1, color: "Apricot", vaccinationStatus: "PARTIAL", ownerId: c3.id } });
  const pets = [bruno, momo, kiwi, rocky, luna, coco];
  const owners = [c1, c1, c2, c2, c3, c3];

  console.log("📅 Creating 6 months of appointments, payments, treatments, reviews...");
  const now = new Date();
  const providers = { vet1, vet2, groomer };
  const vetServices = [sConsult, sVaccine, sDental, sTreatment, sLab];
  const groomServices = [sGroom, sBath, sNail];
  const times = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];
  const diagPool = [
    { symptoms: "Loss of appetite, low energy", diagnosis: "Mild stomach infection", plan: "Oral medication", medication: "Metrogyl syrup", dosage: "5ml — twice daily for 5 days" },
    { symptoms: "Scratching, red skin patches", diagnosis: "Allergic dermatitis", plan: "Medicated bath + antihistamine", medication: "Cetirizine", dosage: "2.5mg — once daily for 7 days" },
    { symptoms: "Limping on front leg", diagnosis: "Minor paw pad injury", plan: "Topical ointment + rest", medication: "Neosporin", dosage: "Apply twice daily" },
    { symptoms: "Sneezing, watery eyes", diagnosis: "Upper respiratory infection", plan: "Antibiotic course", medication: "Azithromycin", dosage: "1ml — once daily for 5 days" },
    { symptoms: "Bad breath, tartar", diagnosis: "Early periodontal disease", plan: "Dental scaling done, follow-up in 6 months", medication: "Chlorhexidine rinse", dosage: "Twice weekly" },
  ];
  const reviewPool = [
    { rating: 5, comment: "Dr. Nusrat was so gentle with Bruno. Best vet visit we've had!" },
    { rating: 4, comment: "Great service, a little waiting but worth it." },
    { rating: 5, comment: "Momo came back fluffy and calm. Sadia is amazing." },
    { rating: 5, comment: "Very thorough check-up and clear explanations." },
    { rating: 3, comment: "Decent experience overall, booking was easy." },
    { rating: 4, comment: "Rocky usually hates baths — he actually enjoyed it!" },
    { rating: 5, comment: "Quick nail trim, no stress at all. Highly recommend." },
    { rating: 4, comment: "Lab results came fast, vet called to explain them." },
  ];
  let reviewIdx = 0;
  let invoiceCounter = 1000;
  const methods = ["CARD", "CASH", "MOBILE"];

  // proper small PRNG (mulberry32) — avoids short-cycle pick patterns
  let s = 1337;
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  async function createAppointment(opts: {
    date: string; time: string; petIdx: number; service: typeof sConsult;
    providerId: string; status: string; paymentStatus: string; payMethod?: string;
    withTreatment?: boolean; withReview?: boolean; notes?: string;
  }) {
    const pet = pets[opts.petIdx];
    const customer = owners[opts.petIdx];
    const appt = await db.appointment.create({
      data: {
        customerId: customer.id, petId: pet.id, serviceId: opts.service.id, providerId: opts.providerId,
        date: opts.date, time: opts.time, status: opts.status, paymentStatus: opts.paymentStatus,
        price: opts.service.price, notes: opts.notes,
      },
    });
    if (opts.paymentStatus === "PAID") {
      invoiceCounter++;
      await db.payment.create({
        data: {
          invoiceId: `INV-${invoiceCounter}`, appointmentId: appt.id, customerId: customer.id,
          amount: opts.service.price, method: opts.payMethod ?? pick(methods),
          transactionId: `TXN${Date.now()}${invoiceCounter}`, status: "PAID",
          paidAt: new Date(`${opts.date}T${opts.time}:00`),
        },
      });
    }
    if (opts.withTreatment) {
      const d = pick(diagPool);
      await db.treatment.create({
        data: {
          appointmentId: appt.id, petId: pet.id, providerId: opts.providerId,
          symptoms: d.symptoms, diagnosis: d.diagnosis, treatmentPlan: d.plan,
          prescription: `${d.medication} ${d.dosage}`, medication: d.medication, dosage: d.dosage,
          followUpDate: fmt(addDays(new Date(opts.date), 14)),
          notes: "Recovery going well. Continue medication as prescribed.",
        },
      });
    }
    if (opts.withReview) {
      const r = reviewPool[reviewIdx % reviewPool.length];
      reviewIdx++;
      await db.review.create({
        data: {
          appointmentId: appt.id, customerId: customer.id, petId: pet.id,
          serviceId: opts.service.id, providerId: opts.providerId,
          rating: r.rating, comment: r.comment,
          status: reviewIdx % 7 === 0 ? "PENDING" : "APPROVED",
          createdAt: new Date(`${opts.date}T18:30:00`),
        },
      });
    }
    return appt;
  }

  // ---- Past months (5,4,3,2,1 months ago + current month before today) ----
  for (let monthAgo = 5; monthAgo >= 0; monthAgo--) {
    const count = monthAgo === 0 ? 8 : 7 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      let date: Date;
      if (monthAgo === 0) {
        date = addDays(now, -(Math.floor(rand() * 12) + 1)); // within last ~12 days of current month
      } else {
        date = new Date(now.getFullYear(), now.getMonth() - monthAgo, (Math.floor(rand() * 26)) + 1);
      }
      const service = pick(services);
      const provider = groomServices.includes(service) ? groomer : pick([vet1, vet2]);
      const petIdx = Math.floor(rand() * pets.length);
      const isCancelled = rand() < 0.08;
      const completed = !isCancelled;
      const withReview = completed && rand() > 0.35;
      const withTreatment = completed && vetServices.includes(service);
      await createAppointment({
        date: fmt(date), time: pick(times), petIdx, service, providerId: provider.id,
        status: isCancelled ? "CANCELLED" : "COMPLETED",
        paymentStatus: isCancelled ? (rand() < 0.5 ? "UNPAID" : "REFUNDED") : "PAID",
        withTreatment, withReview,
      });
    }
  }

  // ---- Upcoming: next 14 days + a couple of far-future bookings ----
  const upcomingSpecs: Array<Parameters<typeof createAppointment>[0]> = [
    { date: fmt(addDays(now, 1)), time: "10:00", petIdx: 0, service: sConsult, providerId: vet1.id, status: "CONFIRMED", paymentStatus: "PAID", notes: "Annual wellness check." },
    { date: fmt(addDays(now, 1)), time: "15:00", petIdx: 2, service: sGroom, providerId: groomer.id, status: "CONFIRMED", paymentStatus: "PAID", notes: "Kiwi's feathers trimmed lightly." },
    { date: fmt(addDays(now, 2)), time: "11:00", petIdx: 1, service: sVaccine, providerId: vet2.id, status: "PENDING", paymentStatus: "UNPAID", notes: "Second dose booster." },
    { date: fmt(addDays(now, 3)), time: "12:00", petIdx: 3, service: sBath, providerId: groomer.id, status: "PENDING", paymentStatus: "UNPAID" },
    { date: fmt(now), time: "14:00", petIdx: 4, service: sDental, providerId: vet2.id, status: "CHECKED_IN", paymentStatus: "PAID" },
    { date: fmt(now), time: "15:00", petIdx: 5, service: sGroom, providerId: groomer.id, status: "IN_PROGRESS", paymentStatus: "UNPAID", notes: "Teddy bear cut please." },
    { date: fmt(addDays(now, 5)), time: "09:00", petIdx: 0, service: sNail, providerId: groomer.id, status: "PENDING", paymentStatus: "UNPAID" },
    { date: fmt(addDays(now, 2)), time: "09:00", petIdx: 0, service: sConsult, providerId: vet1.id, status: "PENDING", paymentStatus: "UNPAID", notes: "Skin rash on belly — needs review." },
    { date: fmt(addDays(now, 4)), time: "16:00", petIdx: 1, service: sGroom, providerId: groomer.id, status: "CONFIRMED", paymentStatus: "PAID" },
    { date: fmt(addDays(now, 6)), time: "10:00", petIdx: 3, service: sVaccine, providerId: vet1.id, status: "CONFIRMED", paymentStatus: "PAID", notes: "Annual rabies booster." },
    { date: fmt(addDays(now, 8)), time: "11:00", petIdx: 5, service: sConsult, providerId: vet1.id, status: "PENDING", paymentStatus: "UNPAID" },
    { date: fmt(addDays(now, 10)), time: "14:00", petIdx: 4, service: sLab, providerId: vet2.id, status: "CONFIRMED", paymentStatus: "PAID" },
    { date: fmt(addDays(now, 13)), time: "15:00", petIdx: 2, service: sNail, providerId: groomer.id, status: "PENDING", paymentStatus: "UNPAID" },
    { date: fmt(addDays(now, 30)), time: "10:00", petIdx: 0, service: sVaccine, providerId: vet1.id, status: "CONFIRMED", paymentStatus: "UNPAID", notes: "6-month booster plan." },
    { date: fmt(addDays(now, 45)), time: "12:00", petIdx: 3, service: sConsult, providerId: vet2.id, status: "PENDING", paymentStatus: "UNPAID", notes: "Hip check follow-up." },
  ];
  for (const spec of upcomingSpecs) await createAppointment(spec);

  console.log("🔔 Creating notifications...");
  const notifs = [
    { userId: c1.id, title: "Appointment confirmed", message: "Bruno's Veterinary Consultation with Dr. Nusrat Jahan is confirmed for tomorrow at 10:00.", type: "STATUS" },
    { userId: c1.id, title: "Payment successful", message: "৳800 paid for Veterinary Consultation. Invoice INV-2042.", type: "PAYMENT" },
    { userId: c1.id, title: "Treatment record added", message: "Dr. Nusrat Jahan added a treatment record for Bruno.", type: "TREATMENT" },
    { userId: c1.id, title: "Appointment reminder", message: "Momo's Vaccination is coming up in 2 days at 11:00.", type: "BOOKING" },
    { userId: c2.id, title: "Appointment confirmed", message: "Kiwi's Full Grooming with Sadia Karim is confirmed for tomorrow at 15:00.", type: "STATUS" },
    { userId: c3.id, title: "Payment received", message: "Your payment of ৳1500 for Dental Care was received.", type: "PAYMENT" },
    { userId: vet1.id, title: "New appointment booked", message: "Rahim Uddin booked Veterinary Consultation for Bruno.", type: "BOOKING" },
    { userId: groomer.id, title: "New appointment booked", message: "Nila Akter booked Full Grooming for Kiwi.", type: "BOOKING" },
    { userId: admin.id, title: "New booking received", message: "A new appointment was booked on the platform.", type: "BOOKING" },
    { userId: staff.id, title: "Payment received", message: "A new payment of ৳1800 was recorded.", type: "PAYMENT" },
  ];
  let i = 0;
  for (const nf of notifs) {
    await db.notification.create({ data: { ...nf, read: i > 3, createdAt: new Date(Date.now() - i * 3600_000) } });
    i++;
  }

  const [userCount, apptCount, payCount] = await Promise.all([
    db.user.count(), db.appointment.count(), db.payment.count(),
  ]);
  console.log(`✅ Seed complete: ${userCount} users, ${pets.length} pets, ${services.length} services, ${apptCount} appointments, ${payCount} payments`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const BANGLA_TAKES = [
  "আমি মনে করি সপ্তাহে অন্তত দুই দিন অফিসে যাওয়া দরকার, তাহলে টিমওয়ার্ক ভালো হয়।",
  "পুরোপুরি রিমোট কাজ করলে ক্যারিয়ার ক্ষতিগ্রস্ত হয়, বিশেষত নতুনদের জন্য।",
  "আমার কাছে মনে হয় হাইব্রিড সিস্টেমই সবচেয়ে ভালো — সপ্তাহে তিন দিন ঘর থেকে।",
  "অফিসে যাওয়া আসলে যোগাযোগ বাড়ায়, কিন্তু ঢাকার ট্রাফিকে অনেক সময় নষ্ট হয়।",
  "আমার মতে রিমোট কাজ productivity বাড়ায়, কারণ distraction কম।",
  "সব কোম্পানির একই নিয়ম হওয়া উচিত না, যার যার কাজের ধরন অনুযায়ী সিদ্ধান্ত নেওয়া উচিত।",
  "আমি রিমোট কাজের পক্ষে, কিন্তু দলের মিটিংয়ের জন্য মাসে অন্তত একবার অফিসে যাওয়া দরকার।",
  "অফিসে কাজ করলে senior থেকে শেখার সুযোগ বেশি, তাই নতুনদের অফিসে থাকা উচিত।",
  "আমার ম্যানেজার রিমোটে কাজের মান নিয়ে সন্দেহ করেন, এটা দুঃখজনক।",
  "ঢাকায় বসবাস করা ছাড়াও অনেকে ভালো কাজ করতে পারেন যদি রিমোট অপশন থাকে।",
  "আমি মনে করি অফিস environment টিমের spirit বাড়ায় এবং কাজের culture তৈরি করে।",
  "রিমোট কাজ করলে electricity bill বাড়ে, এটাও একটা বিষয় কোম্পানিকে বিবেচনা করতে হবে।",
  "আমার মতে সপ্তাহে ৫ দিনই অফিস করা উচিত — এটাই professional।",
  "Remote work করলে work-life balance ভালো থাকে, পরিবারের সাথে সময় দেওয়া যায়।",
  "Hybrid কাজ করার জন্য কোম্পানিকে ভালো infrastructure দিতে হবে বাড়িতে।",
  "আমার experience এ দেখেছি রিমোটে team bonding হয় না ঠিকমতো।",
  "সরকারি চাকরিতে রিমোট কাজের সুযোগ এখনও খুব কম, এটা পরিবর্তন হওয়া দরকার।",
  "Tech কোম্পানিগুলো রিমোট কাজে ভালো করছে, কিন্তু manufacturing sector এ সম্ভব না।",
  "আমি মনে করি কাজের performance দেখে বিচার করা উচিত, কোথায় বসে কাজ করছি সেটা না।",
  "অফিসে যাওয়া-আসায় দিনে ২-৩ ঘণ্টা নষ্ট হয়, এই সময়টা productive কাজে লাগানো যেত।",
  "আমার কোম্পানি হাইব্রিড করেছে কিন্তু কোনো proper policy নেই, সবাই confused।",
  "রিমোট কাজ করলে internet connection এর সমস্যা হয়, বিশেষত ঢাকার বাইরে।",
  "আমি মনে করি manager দের trust করতে শিখতে হবে, তাহলেই remote কাজ সফল হবে।",
  "অফিস environment এ অনেক politics থাকে, রিমোটে সেটা কম।",
  "সপ্তাহে দুই দিন অফিস করলে যথেষ্ট মনে হয়, বাকি দিন remote।",
  "আমার মতে কোম্পানিগুলো cost save করতে remote কাজ চালু রাখছে, এটা শ্রমিকের জন্য ভালো না।",
  "Flexible hours এর option থাকলে অফিসে যেতে সমস্যা নেই।",
  "Remote কাজে একাকীত্ব feel হয়, social interaction এর অভাব মানসিক স্বাস্থ্যে প্রভাব ফেলে।",
  "আমি fully remote তে সুখী, কিন্তু স্বীকার করতে হবে discipline maintain করা কঠিন।",
  "Office কাজে spontaneous conversation থেকে অনেক ভালো idea আসে।",
  "সরকার remote কাজের জন্য policy করলে অনেক মানুষ শহর ছেড়ে গ্রামে যেতে পারবে।",
  "আমার মতে full time office mandatory করা অন্যায়, employee দের choice থাকা উচিত।",
  "Hybrid কাজ করতে গিয়ে meeting schedule করা কঠিন হয়ে যায়।",
  "Remote কাজে career visibility কমে যায়, boss এর সামনে দেখা না গেলে promotion পাওয়া কঠিন।",
  "আমি চাই কোম্পানি output দেখুক, hours track না করুক।",
  "Bangladesh এ remote work culture এখনও develop হয়নি, আমরা পিছিয়ে আছি।",
  "অফিসে গেলে free tea coffee পাই, এটাও একটা benefit।",
  "Remote কাজে family এর কাছ থেকে distraction বেশি হয়।",
  "IT sector এ remote কাজ normal হলেও অন্য sector এ এখনও সম্ভব না।",
  "আমার মতে company culture আর work style এর উপর নির্ভর করে কোনটা best।",
];

async function main() {
  console.log("Seeding database...");

  // Create a system user for seeded content
  const systemUser = await db.user.upsert({
    where: { email: "system@voices.internal" },
    update: {},
    create: {
      email: "system@voices.internal",
      displayName: "System",
      isAnon: false,
    },
  });

  // Create anon users for fake takes
  const anonUsers: { id: string }[] = [];
  for (let i = 0; i < 15; i++) {
    const u = await db.user.create({ data: { isAnon: true } });
    anonUsers.push(u);
  }

  // Delete existing live topic if any (clean slate)
  await db.topic.deleteMany({ where: { week: 1 } });

  const now = new Date();
  const closesAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

  const topic = await db.topic.create({
    data: {
      week: 1,
      category: "work",
      question: "বাংলাদেশের প্রেক্ষাপটে কাজের ক্ষেত্রে 'রিমোট', 'হাইব্রিড' নাকি 'সম্পূর্ণ অফিস' — আপনার মত কী?",
      questionEn:
        "In Bangladesh's context, for work: 'Remote', 'Hybrid', or 'Full office' — what's your take?",
      context:
        "করোনার পর থেকে কাজের ধরন বদলে গেছে। অনেক কোম্পানি এখন ফুল অফিস ফিরিয়ে আনছে, কেউ হাইব্রিড রাখছে। আপনার অভিজ্ঞতা ও মত শেয়ার করুন।",
      opensAt: now,
      closesAt,
      status: "live",
      createdByUserId: systemUser.id,
    },
  });

  console.log("Created topic:", topic.id);

  // Create 8 clusters
  const clusterData = [
    {
      label: "সম্পূর্ণ রিমোট চাই",
      summary: "প্রতিদিন অফিসে যাওয়ার প্রয়োজন নেই, ঘর থেকেই সব কাজ হোক।",
      order: 0,
    },
    {
      label: "সপ্তাহে ২-৩ দিন অফিস (হাইব্রিড)",
      summary: "অফিস ও বাড়ির মধ্যে ভারসাম্য রক্ষা করে সেরা ফল পাওয়া সম্ভব।",
      order: 1,
    },
    {
      label: "সম্পূর্ণ অফিসে কাজ করাই ভালো",
      summary: "দলের সাথে সরাসরি কাজ করলে productivity ও team bonding বাড়ে।",
      order: 2,
    },
    {
      label: "কর্মীর ইচ্ছার উপর ছেড়ে দেওয়া উচিত",
      summary: "প্রতিটি মানুষের কাজের ধরন আলাদা, তাই choice থাকা দরকার।",
      order: 3,
    },
    {
      label: "নতুনদের অফিসে থাকা উচিত, অভিজ্ঞরা রিমোটে",
      summary: "নতুন কর্মীরা mentorship ও learning এর জন্য অফিসে থাকলে ভালো করবে।",
      order: 4,
    },
    {
      label: "ঢাকার বাইরের মানুষদের রিমোট অ্যাক্সেস দেওয়া উচিত",
      summary: "রিমোট কাজ চালু হলে শুধু ঢাকায় নয়, সারা দেশে কর্মসংস্থান সম্ভব।",
      order: 5,
    },
    {
      label: "Output দেখে বিচার হোক, উপস্থিতি নয়",
      summary: "কাজের মান দেখে কর্মীকে মূল্যায়ন করা উচিত, কোথায় বসে কাজ করছেন সেটা না।",
      order: 6,
    },
    {
      label: "বাংলাদেশে রিমোট সংস্কৃতি এখনও প্রস্তুত নয়",
      summary: "Internet infra, power outage ও management culture এখনও remote work এর জন্য উপযুক্ত নয়।",
      order: 7,
    },
  ];

  const clusters = await db.$transaction(
    clusterData.map((c) =>
      db.cluster.create({
        data: {
          topicId: topic.id,
          label: c.label,
          summary: c.summary,
          isAiSeeded: true,
          order: c.order,
        },
      })
    )
  );

  console.log("Created", clusters.length, "clusters");

  // Distribute 40 fake takes across clusters
  const weights = [0.25, 0.28, 0.12, 0.10, 0.08, 0.07, 0.06, 0.04];
  let takeCount = 0;

  for (let ci = 0; ci < clusters.length; ci++) {
    const cluster = clusters[ci];
    const count = Math.round(weights[ci] * 40);

    for (let j = 0; j < count && takeCount < BANGLA_TAKES.length; j++) {
      const user = anonUsers[takeCount % anonUsers.length];
      const content = BANGLA_TAKES[takeCount % BANGLA_TAKES.length];

      await db.take.create({
        data: {
          topicId: topic.id,
          clusterId: cluster.id,
          userId: user.id,
          content,
          isAnon: true,
          asrConfidence: 0.75 + Math.random() * 0.23,
          asrProvider: "deepgram",
          aiMatchScore: 0.7 + Math.random() * 0.28,
          isPublished: true,
          isPending: false,
        },
      });
      takeCount++;
    }
  }

  // Add some votes
  for (const cluster of clusters) {
    const voteCount = Math.floor(Math.random() * 20) + 5;
    for (let v = 0; v < voteCount; v++) {
      const user = anonUsers[v % anonUsers.length];
      try {
        await db.vote.create({
          data: {
            clusterId: cluster.id,
            userId: user.id,
            direction: Math.random() > 0.25 ? "up" : "down",
          },
        });
      } catch {
        // Duplicate vote — skip
      }
    }
  }

  console.log(`Seeded ${takeCount} takes`);
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

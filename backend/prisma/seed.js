require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── Create Admin User ───────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@stationeryhub.com' },
    update: {},
    create: {
      email: 'admin@stationeryhub.com',
      passwordHash: adminPassword,
      name: 'Admin',
      role: 'ADMIN',
      emailVerified: true,
      phone: '+8801700000001',
    },
  });
  console.log(`  ✅ Admin user: ${admin.email}`);

  // ─── Create Staff User ────────────────────────────────
  const staffPassword = await bcrypt.hash('staff123', 12);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@stationeryhub.com' },
    update: {},
    create: {
      email: 'staff@stationeryhub.com',
      passwordHash: staffPassword,
      name: 'Rakib (Staff)',
      role: 'STAFF',
      emailVerified: true,
      phone: '+8801700000002',
    },
  });
  console.log(`  ✅ Staff user: ${staff.email}`);

  // ─── Create Customer User ─────────────────────────────
  const custPassword = await bcrypt.hash('customer123', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: custPassword,
      name: 'Karim (Customer)',
      role: 'CUSTOMER',
      emailVerified: true,
      phone: '+8801700000003',
    },
  });
  console.log(`  ✅ Customer user: ${customer.email}`);

  // ─── Create Categories ────────────────────────────────
  const categories = [
    { name: 'Paper & Notebooks', slug: 'paper-notebooks', description: 'All types of paper, notebooks, and writing pads', sortOrder: 1 },
    { name: 'Pens & Writing', slug: 'pens-writing', description: 'Pens, pencils, markers, and highlighters', sortOrder: 2 },
    { name: 'Office Supplies', slug: 'office-supplies', description: 'Staplers, clips, folders, and desk accessories', sortOrder: 3 },
    { name: 'Art & Craft', slug: 'art-craft', description: 'Colors, brushes, craft paper, and art materials', sortOrder: 4 },
    { name: 'Printing & Ink', slug: 'printing-ink', description: 'Printer paper, ink cartridges, and toner', sortOrder: 5 },
    { name: 'Files & Folders', slug: 'files-folders', description: 'Files, folders, binders, and document organizers', sortOrder: 6 },
    { name: 'School Supplies', slug: 'school-supplies', description: 'Geometry sets, erasers, sharpeners, and school essentials', sortOrder: 7 },
    { name: 'Desk & Storage', slug: 'desk-storage', description: 'Pen holders, trays, shelves, and organizers', sortOrder: 8 },
  ];

  const createdCategories = {};
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    createdCategories[cat.slug] = c;
  }
  console.log(`  ✅ ${categories.length} categories created`);

  // ─── Create Products ──────────────────────────────────
  const products = [
    // Paper & Notebooks
    { name: 'A4 Paper (500 sheets)', sku: 'PAP-A4-500', categorySlug: 'paper-notebooks', price: 450, stock: 200, unit: 'ream', description: 'Premium quality A4 white paper, 80gsm, 500 sheets per ream' },
    { name: 'A4 Paper (100 sheets)', sku: 'PAP-A4-100', categorySlug: 'paper-notebooks', price: 120, stock: 300, unit: 'pack', description: 'A4 white paper, 80gsm, 100 sheets pack' },
    { name: 'Legal Paper (500 sheets)', sku: 'PAP-LG-500', categorySlug: 'paper-notebooks', price: 500, stock: 100, unit: 'ream', description: 'Legal size paper, 80gsm' },
    { name: 'Spiral Notebook A4', sku: 'NB-SPRL-A4', categorySlug: 'paper-notebooks', price: 85, stock: 150, unit: 'pc', description: '200 page spiral bound notebook' },
    { name: 'Spiral Notebook A5', sku: 'NB-SPRL-A5', categorySlug: 'paper-notebooks', price: 55, stock: 200, unit: 'pc', description: '120 page spiral bound notebook' },
    { name: 'Register Book (200 page)', sku: 'NB-REG-200', categorySlug: 'paper-notebooks', price: 150, stock: 80, unit: 'pc', description: 'Hardcover register book' },
    { name: 'Post-it Notes (3x3)', sku: 'PAP-POST-3', categorySlug: 'paper-notebooks', price: 65, stock: 300, unit: 'pack', description: 'Sticky notes, 100 sheets, assorted colors' },
    { name: 'Khata (120 page)', sku: 'NB-KHATA-120', categorySlug: 'paper-notebooks', price: 30, stock: 500, unit: 'pc', description: 'Standard school exercise book' },

    // Pens & Writing
    { name: 'Matador Ball Pen (Blue)', sku: 'PEN-MAT-BL', categorySlug: 'pens-writing', price: 10, stock: 1000, unit: 'pc', description: 'Matador blue ballpoint pen' },
    { name: 'Matador Ball Pen (Black)', sku: 'PEN-MAT-BK', categorySlug: 'pens-writing', price: 10, stock: 800, unit: 'pc', description: 'Matador black ballpoint pen' },
    { name: 'Matador Ball Pen (Red)', sku: 'PEN-MAT-RD', categorySlug: 'pens-writing', price: 10, stock: 500, unit: 'pc', description: 'Matador red ballpoint pen' },
    { name: 'Gel Pen (Black)', sku: 'PEN-GEL-BK', categorySlug: 'pens-writing', price: 25, stock: 300, unit: 'pc', description: '0.5mm gel pen' },
    { name: 'Pilot Pen (Blue)', sku: 'PEN-PLT-BL', categorySlug: 'pens-writing', price: 45, stock: 200, unit: 'pc', description: 'Pilot V5 Hi-Tecpoint' },
    { name: 'Pencil 2B', sku: 'PEN-PCL-2B', categorySlug: 'pens-writing', price: 8, stock: 800, unit: 'pc', description: 'Standard 2B pencil' },
    { name: 'Mechanical Pencil 0.5mm', sku: 'PEN-MEC-05', categorySlug: 'pens-writing', price: 35, stock: 200, unit: 'pc', description: '0.5mm mechanical pencil with lead' },
    { name: 'Whiteboard Marker (Set of 4)', sku: 'PEN-WBM-4', categorySlug: 'pens-writing', price: 120, stock: 100, unit: 'set', description: 'Assorted color whiteboard markers' },
    { name: 'Highlighter (Set of 5)', sku: 'PEN-HLT-5', categorySlug: 'pens-writing', price: 90, stock: 150, unit: 'set', description: 'Fluorescent highlighter set' },
    { name: 'Permanent Marker (Black)', sku: 'PEN-PMK-BK', categorySlug: 'pens-writing', price: 30, stock: 200, unit: 'pc', description: 'Waterproof permanent marker' },

    // Office Supplies
    { name: 'Stapler (Standard)', sku: 'OFF-STPL-S', categorySlug: 'office-supplies', price: 120, stock: 50, unit: 'pc', description: 'Standard desktop stapler' },
    { name: 'Stapler Pins (No. 10)', sku: 'OFF-STPN-10', categorySlug: 'office-supplies', price: 15, stock: 500, unit: 'box', description: '1000 pins per box' },
    { name: 'Paper Clips (100pcs)', sku: 'OFF-CLIP-100', categorySlug: 'office-supplies', price: 20, stock: 300, unit: 'box', description: 'Standard paper clips' },
    { name: 'Binder Clips (12pcs)', sku: 'OFF-BCLP-12', categorySlug: 'office-supplies', price: 40, stock: 200, unit: 'box', description: '25mm binder clips' },
    { name: 'Scissors (7 inch)', sku: 'OFF-SCSR-7', categorySlug: 'office-supplies', price: 60, stock: 100, unit: 'pc', description: 'Stainless steel scissors' },
    { name: 'Tape (Clear, 1 inch)', sku: 'OFF-TAPE-1', categorySlug: 'office-supplies', price: 25, stock: 300, unit: 'roll', description: 'Clear adhesive tape' },
    { name: 'Glue Stick', sku: 'OFF-GLUE-S', categorySlug: 'office-supplies', price: 20, stock: 200, unit: 'pc', description: '8g glue stick' },
    { name: 'Calculator (12 Digit)', sku: 'OFF-CALC-12', categorySlug: 'office-supplies', price: 350, stock: 30, unit: 'pc', description: 'Desktop calculator' },
    { name: 'Rubber Band Pack', sku: 'OFF-RBBND', categorySlug: 'office-supplies', price: 15, stock: 200, unit: 'pack', description: 'Assorted rubber bands, 100g' },

    // Art & Craft
    { name: 'Color Pencil Set (12)', sku: 'ART-CP-12', categorySlug: 'art-craft', price: 80, stock: 100, unit: 'set', description: '12 color pencil set' },
    { name: 'Crayon Set (24)', sku: 'ART-CRY-24', categorySlug: 'art-craft', price: 120, stock: 100, unit: 'set', description: '24 color crayon set' },
    { name: 'Watercolor Set (12)', sku: 'ART-WC-12', categorySlug: 'art-craft', price: 150, stock: 80, unit: 'set', description: '12 color watercolor cake set' },
    { name: 'Drawing Paper A3', sku: 'ART-DRW-A3', categorySlug: 'art-craft', price: 200, stock: 60, unit: 'pack', description: '50 sheets, 120gsm drawing paper' },
    { name: 'Craft Paper (Assorted)', sku: 'ART-CRF-AS', categorySlug: 'art-craft', price: 45, stock: 150, unit: 'pack', description: '20 sheets assorted color craft paper' },

    // Printing & Ink
    { name: 'Printer Paper A4 (500 sheets)', sku: 'PRT-A4-500', categorySlug: 'printing-ink', price: 480, stock: 100, unit: 'ream', description: 'Premium printer paper, 75gsm' },
    { name: 'HP Ink Cartridge (Black)', sku: 'PRT-HP-BK', categorySlug: 'printing-ink', price: 1200, stock: 15, unit: 'pc', description: 'HP 680 black ink cartridge' },
    { name: 'HP Ink Cartridge (Color)', sku: 'PRT-HP-CL', categorySlug: 'printing-ink', price: 1400, stock: 12, unit: 'pc', description: 'HP 680 tri-color ink cartridge' },
    { name: 'Carbon Paper (100 sheets)', sku: 'PRT-CARB-100', categorySlug: 'printing-ink', price: 180, stock: 50, unit: 'pack', description: 'Blue carbon paper for hand copies' },

    // Files & Folders
    { name: 'Clear File Folder (10pcs)', sku: 'FIL-CLR-10', categorySlug: 'files-folders', price: 80, stock: 100, unit: 'pack', description: 'Transparent L-shape folders' },
    { name: 'Ring Binder (A4)', sku: 'FIL-RING-A4', categorySlug: 'files-folders', price: 120, stock: 60, unit: 'pc', description: '2-ring binder, 1.5 inch' },
    { name: 'Lever Arch File', sku: 'FIL-LAF-A4', categorySlug: 'files-folders', price: 180, stock: 40, unit: 'pc', description: 'A4 lever arch file' },
    { name: 'Box File', sku: 'FIL-BOX-A4', categorySlug: 'files-folders', price: 200, stock: 30, unit: 'pc', description: 'A4 box file with clip' },
    { name: 'Envelope (White, 50pcs)', sku: 'FIL-ENV-50', categorySlug: 'files-folders', price: 60, stock: 200, unit: 'pack', description: 'Standard white envelope' },

    // School Supplies
    { name: 'Geometry Set', sku: 'SCH-GEO-S', categorySlug: 'school-supplies', price: 80, stock: 100, unit: 'set', description: 'Complete geometry box set' },
    { name: 'Eraser (Pack of 5)', sku: 'SCH-ERS-5', categorySlug: 'school-supplies', price: 20, stock: 500, unit: 'pack', description: 'White dust-free erasers' },
    { name: 'Sharpener (Metal)', sku: 'SCH-SHRP-M', categorySlug: 'school-supplies', price: 10, stock: 300, unit: 'pc', description: 'Metal pencil sharpener' },
    { name: 'School Bag', sku: 'SCH-BAG-S', categorySlug: 'school-supplies', price: 650, stock: 30, unit: 'pc', description: 'Durable school backpack' },
    { name: 'Pencil Box', sku: 'SCH-PBOX', categorySlug: 'school-supplies', price: 120, stock: 50, unit: 'pc', description: 'Multi-compartment pencil box' },

    // Desk & Storage
    { name: 'Pen Holder', sku: 'DSK-PNHLD', categorySlug: 'desk-storage', price: 80, stock: 40, unit: 'pc', description: 'Metal mesh pen holder' },
    { name: 'Document Tray (3-tier)', sku: 'DSK-TRAY-3', categorySlug: 'desk-storage', price: 250, stock: 20, unit: 'pc', description: '3-tier stackable document tray' },
    { name: 'Desk Organizer', sku: 'DSK-ORG', categorySlug: 'desk-storage', price: 350, stock: 15, unit: 'pc', description: 'Multi-compartment desk organizer' },
    { name: 'Whiteboard (2x3 ft)', sku: 'DSK-WB-23', categorySlug: 'desk-storage', price: 800, stock: 10, unit: 'pc', description: 'Magnetic whiteboard with markers' },
  ];

  let productCount = 0;
  for (const prod of products) {
    const slug = prod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await prisma.product.upsert({
      where: { sku: prod.sku },
      update: {},
      create: {
        name: prod.name,
        slug,
        sku: prod.sku,
        categoryId: createdCategories[prod.categorySlug].id,
        description: prod.description,
        price: prod.price,
        stock: prod.stock,
        unit: prod.unit,
        isActive: true,
      },
    });
    productCount++;
  }
  console.log(`  ✅ ${productCount} products created`);

  // ─── Create Sample Customers ──────────────────────────
  const customers = [
    { contactPerson: 'Mohammad Karim', companyName: 'Karim Traders', phone: '+8801711111111', email: 'karim@traders.com', address: 'Basundhara R/A, Block C, Dhaka' },
    { contactPerson: 'Fatima Akhter', companyName: 'ABC School', phone: '+8801722222222', email: 'fatima@abcschool.edu.bd', address: 'Bashundhara R/A, Block D, Dhaka' },
    { contactPerson: 'Rahim Uddin', companyName: 'Rahim Office Supply', phone: '+8801733333333', email: 'rahim@officesupply.com', address: 'Gulshan-2, Dhaka' },
    { contactPerson: 'Nasreen Begum', companyName: null, phone: '+8801744444444', email: null, address: 'Banani, Dhaka', notes: 'Regular customer, pays on delivery' },
  ];

  const existingCustomers = await prisma.customer.count();
  if (existingCustomers === 0) {
    await prisma.customer.createMany({ data: customers });
  }
  console.log(`  ✅ Sample customers created`);

  // ─── Referral Codes ──────────────────────────────────
  await prisma.user.update({ where: { email: 'admin@stationeryhub.com' }, data: { referralCode: 'ADMI1234' } });
  await prisma.user.update({ where: { email: 'staff@stationeryhub.com' }, data: { referralCode: 'STAF5678' } });
  await prisma.user.update({ where: { email: 'customer@example.com' }, data: { referralCode: 'CUST9012' } });

  // ─── Sample Promo Codes ──────────────────────────────
  await prisma.promoCode.createMany({
    data: [
      {
        code: 'WELCOME10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        usageLimit: 100,
        minOrderAmount: 500,
      },
      {
        code: 'SAVE100',
        discountType: 'FIXED',
        discountValue: 100,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        usageLimit: 50,
        minOrderAmount: 1000,
      },
    ],
    skipDuplicates: true,
  });
  console.log('  ✅ Promo codes seeded');

  console.log('\n🎉 Seeding complete!\n');
  console.log('  Test accounts:');
  console.log('  ├── Admin: admin@stationeryhub.com / admin123');
  console.log('  ├── Staff: staff@stationeryhub.com / staff123');
  console.log('  └── Customer: customer@example.com / customer123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

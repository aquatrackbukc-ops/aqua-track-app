import { initializeApp } from "firebase/app";
import { getDatabase, ref, update } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA0Bms7zKHOxJ2W_g_HKVseEp_wBB-W7xQ",
  authDomain: "aquatrack-98962.firebaseapp.com",
  databaseURL: "https://aquatrack-98962-default-rtdb.firebaseio.com/",
  projectId: "aquatrack-98962",
  storageBucket: "aquatrack-98962.firebasestorage.app",
  messagingSenderId: "484284815346",
  appId: "1:484284815346:web:ab615e0cba59e4dbd5fd6b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const pricePerLiter = 0.05;

const generateMonthData = (year, monthIndex, baseLiters) => {
  const date = new Date(year, monthIndex);
  const monthName = date.toLocaleString('en-US', { month: 'long' }) + ' ' + year;
  const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  
  const variation = 0.8 + (Math.random() * 0.4); // +/- 20%
  const totalLiters = parseFloat((baseLiters * variation).toFixed(1));
  const totalCost = parseFloat((totalLiters * pricePerLiter).toFixed(2));
  
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const randomDay = Math.floor(Math.random() * daysInMonth) + 1;
  const highestUsageDay = `${monthStr}-${String(randomDay).padStart(2, '0')}`;
  const averageDailyLiters = parseFloat((totalLiters / daysInMonth).toFixed(1));

  return {
    monthName,
    totalLiters,
    totalCost,
    highestUsageDay,
    averageDailyLiters,
    pricePerLiter,
    isPaid: Math.random() > 0.3,
    dueDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-15`
  };
};

const periods = [
  ...Array.from({ length: 12 }, (_, i) => ({ year: 2025, month: i })),
  ...Array.from({ length: 4 }, (_, i) => ({ year: 2026, month: i }))
];

const devices = ['device_01', 'device_02', 'device_03'];
const baseLitersMap = {
  'device_01': 12000,
  'device_02': 5000,
  'device_03': 8500
};

const dummyData = {
  history: {}
};

// Populate History
for (const deviceId of devices) {
  const base = baseLitersMap[deviceId];
  
  // History
  dummyData.history[deviceId] = {};
  for (const { year, month } of periods) {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    dummyData.history[deviceId][monthStr] = generateMonthData(year, month, base);
  }
}

async function seedDatabase() {
  console.log("Seeding ONLY History dummy data to Firebase...");
  try {
    const rootRef = ref(db);
    // Using update at root ensures we don't delete other nodes like 'users', 'AquaTrack', etc.
    await update(rootRef, dummyData);
    console.log("Successfully seeded:");
    console.log(` - 16 months (2025 - Apr 2026) of history for ${devices.join(', ')}`);
    console.log(` - Included pricePerLiter in each month's record.`);
    process.exit(0);
  } catch (error) {
    console.error("Error writing data to Firebase:", error);
    process.exit(1);
  }
}

seedDatabase();

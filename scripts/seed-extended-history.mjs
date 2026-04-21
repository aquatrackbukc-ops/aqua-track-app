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
  
  const variation = 0.8 + (Math.random() * 0.4);
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
    averageDailyLiters
  };
};

const periods = [
  ...Array.from({ length: 12 }, (_, i) => ({ year: 2025, month: i })),
  ...Array.from({ length: 3 }, (_, i) => ({ year: 2026, month: i }))
];

const devices = ['device_01', 'device_02', 'device_03'];
const baseLitersMap = {
  'device_01': 12000,
  'device_02': 5000,
  'device_03': 8500
};

const dummyData = {
  "settings/pricing": {
    pricePerLiter: pricePerLiter,
    currency: "USD",
    lastUpdated: new Date().toISOString()
  },
  history: {},
  AquaTrack: {}
};

// Populate History and Real-time data (AquaTrack node)
for (const deviceId of devices) {
  const base = baseLitersMap[deviceId];
  
  // History
  dummyData.history[deviceId] = {};
  for (const { year, month } of periods) {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    dummyData.history[deviceId][monthStr] = generateMonthData(year, month, base);
  }

  // Real-time (AquaTrack)
  dummyData.AquaTrack[deviceId] = {
    WaterStatus: "Connected",
    FlowRate_LPM: parseFloat((Math.random() * 5).toFixed(2)),
    TotalLiters: parseFloat((base / 30 * (new Date().getDate())).toFixed(1)), // usage so far this month
    Timestamp: new Date().toISOString()
  };
}

async function seedDatabase() {
  console.log("Seeding COMPLETE dummy data (History + Realtime) to Firebase...");
  try {
    const rootRef = ref(db);
    // Using update at root ensures we don't delete other nodes like 'users' if they exist
    // but fully populates history, AquaTrack, and settings/pricing
    await update(rootRef, dummyData);
    console.log("Successfully seeded:");
    console.log(` - 15 months of history for ${devices.join(', ')}`);
    console.log(` - Real-time AquaTrack nodes for ${devices.join(', ')}`);
    console.log(` - Pricing settings`);
    process.exit(0);
  } catch (error) {
    console.error("Error writing data to Firebase:", error);
    console.log("\nTIP: If you see PERMISSION_DENIED, make sure your Firebase Rules allow writes.");
    console.log("Go to Firebase Console -> Realtime Database -> Rules and set '.write': true temporarily.");
    process.exit(1);
  }
}

seedDatabase();

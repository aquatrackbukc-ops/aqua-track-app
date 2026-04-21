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

const dummyData = {
  "settings/pricing": {
    pricePerLiter: 0.05,
    currency: "USD",
    lastUpdated: new Date().toISOString()
  },
  history: {
    device_01: {
      "2023-11": {
        monthName: "November 2023",
        totalLiters: 11736.5,
        totalCost: 586.82,
        highestUsageDay: "2023-11-23",
        averageDailyLiters: 391.2
      },
      "2023-12": {
        monthName: "December 2023",
        totalLiters: 14574.2,
        totalCost: 728.71,
        highestUsageDay: "2023-12-25",
        averageDailyLiters: 470.1
      },
      "2024-01": {
        monthName: "January 2024",
        totalLiters: 10977.6,
        totalCost: 548.88,
        highestUsageDay: "2024-01-01",
        averageDailyLiters: 354.1
      },
      "2024-02": {
        monthName: "February 2024",
        totalLiters: 10412.8,
        totalCost: 520.64,
        highestUsageDay: "2024-02-14",
        averageDailyLiters: 359.0
      },
      "2024-03": {
        monthName: "March 2024",
        totalLiters: 11547.1,
        totalCost: 577.35,
        highestUsageDay: "2024-03-17",
        averageDailyLiters: 372.4
      }
    },
    device_02: {
      "2024-02": {
        monthName: "February 2024",
        totalLiters: 4542.4,
        totalCost: 227.12,
        highestUsageDay: "2024-02-05",
        averageDailyLiters: 156.6
      },
      "2024-03": {
        monthName: "March 2024",
        totalLiters: 5112.5,
        totalCost: 255.62,
        highestUsageDay: "2024-03-22",
        averageDailyLiters: 164.9
      }
    }
  }
};

async function seedDatabase() {
  console.log("Seeding dummy data to Firebase...");
  try {
    const rootRef = ref(db);
    await update(rootRef, dummyData);
    console.log("Successfully seeded history and pricing settings data!");
    process.exit(0);
  } catch (error) {
    console.error("Error writing data to Firebase:", error);
    process.exit(1);
  }
}

seedDatabase();

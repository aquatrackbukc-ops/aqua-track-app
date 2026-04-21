import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";

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

async function inspect() {
  console.log("\n=== AquaTrack device IDs (live sensor nodes) ===");
  const aquaRef = ref(db, "AquaTrack");
  const aquaSnap = await get(aquaRef);
  console.log(aquaSnap.val() ? Object.keys(aquaSnap.val()) : "EMPTY");

  console.log("\n=== history device IDs (what we seeded) ===");
  const histRef = ref(db, "history");
  const histSnap = await get(histRef);
  console.log(histSnap.val() ? Object.keys(histSnap.val()) : "EMPTY");

  console.log("\n=== users (to see device_id field) ===");
  const usersRef = ref(db, "users");
  const usersSnap = await get(usersRef);
  if (usersSnap.val()) {
    Object.entries(usersSnap.val()).forEach(([uid, data]) => {
      console.log(`  uid: ${uid.slice(0, 8)}...  =>  device_id: ${data.device_id}  role: ${data.role}  email: ${data.email}`);
    });
  } else {
    console.log("EMPTY");
  }

  process.exit(0);
}

inspect().catch(e => { console.error(e); process.exit(1); });

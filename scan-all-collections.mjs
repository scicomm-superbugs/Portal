import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC1GvAMikaE9AbbHHJE_Ivqe49Se4FcX-o",
  authDomain: "chompchem.firebaseapp.com",
  projectId: "chompchem",
  storageBucket: "chompchem.firebasestorage.app",
  messagingSenderId: "379599502348",
  appId: "1:379599502348:web:d1be32d868ac2a813f0229",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const allPossibleCollections = [
    "scientists", "alamein_scientists", "aiuscicomm_scientists",
    "compchem_scientists", "scicomm_scientists", "admin_scientists",
    "users", "accounts", "profiles", "members"
  ];

  for (const col of allPossibleCollections) {
    try {
      const snap = await getDocs(collection(db, col));
      if (!snap.empty) {
        console.log(`Scanning collection: ${col}`);
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (
            data.email === "abdullah.amr.makky@gmail.com" || 
            data.googleLinkedEmail === "abdullah.amr.makky@gmail.com" ||
            JSON.stringify(data).includes("abdullah.amr.makky@gmail.com")
          ) {
            console.log(`  [${col}] ID: ${doc.id}, data:`, data);
          }
        });
      }
    } catch (e) {
      // Collection doesn't exist or permission denied, ignore
    }
  }
}

main().catch(console.error);

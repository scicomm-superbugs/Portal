import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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
      const docRef = doc(db, col, "55HY8JaR07QiELJt4v1b");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log(`\nFound 55HY8JaR07QiELJt4v1b in collection '${col}':`);
        console.log(docSnap.data());
      }
    } catch (e) {
      // ignore
    }
  }
  console.log("Search completed!");
}

main().catch(console.error);

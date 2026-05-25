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
  const colName = "scicomm_scientists";
  try {
    const snap = await getDocs(collection(db, colName));
    console.log(`\nCollection '${colName}' exists with ${snap.size} documents:`);
    snap.docs.forEach(docSnap => {
      console.log(`ID: ${docSnap.id}`);
      console.log(docSnap.data());
    });
  } catch (e) {
    console.log(`Collection '${colName}' does not exist or failed: ${e.message}`);
  }
}

main().catch(console.error);

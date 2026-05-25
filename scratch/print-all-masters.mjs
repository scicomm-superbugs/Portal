import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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
  const collectionName = "aiuscicomm_scientists";
  const q = query(collection(db, collectionName), where("role", "==", "master"));
  const snap = await getDocs(q);

  console.log(`Scanning masters in ${collectionName} (${snap.size} docs)...`);
  snap.docs.forEach(docSnap => {
    console.log(`ID: ${docSnap.id}`);
    console.log(docSnap.data());
  });
}

main().catch(console.error);

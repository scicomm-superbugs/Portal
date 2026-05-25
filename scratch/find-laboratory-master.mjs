import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC1GvAMikaE9AbbHHJE_Ivqe49Se4FcX-o",
  authDomain: "chompchem.firebaseapp.com",
  projectId: "chompchem",
  storageBucket: "chompchem.firebasestorage.app",
  measurementId: "G-NWEXYL1PQ0",
  messagingSenderId: "379599502348",
  appId: "1:379599502348:web:d1be32d868ac2a813f0229",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const colName = "aiuscicomm_scientists";
  const snap = await getDocs(collection(db, colName));
  console.log(`Scanning ${colName} (${snap.size} docs)...`);
  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (
      (data.name && data.name.toLowerCase().includes("master")) ||
      (data.username && data.username.toLowerCase().includes("master")) ||
      (data.email && data.email.toLowerCase().includes("master")) ||
      docSnap.id === "master-bypass"
    ) {
      console.log(`Found: ID=${docSnap.id}, name='${data.name}', username='${data.username}', email='${data.email}', role='${data.role}'`);
    }
  });
}

main().catch(console.error);

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
  const collections = ["scientists", "alamein_scientists", "aiuscicomm_scientists"];
  for (const col of collections) {
    console.log(`\n=== Collection: ${col} ===`);
    const snap = await getDocs(collection(db, col));
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`  username: ${data.username}`);
      console.log(`  email: ${data.email}`);
      console.log(`  googleLinkedEmail: ${data.googleLinkedEmail}`);
      console.log(`  googleLinked: ${data.googleLinked}`);
      console.log(`  name: ${data.name}`);
      console.log(`  role: ${data.role}`);
    });
  }
}

main().catch(console.error);

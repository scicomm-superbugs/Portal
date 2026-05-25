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
    console.log(`\nCollection: ${col}`);
    const snap = await getDocs(collection(db, col));
    let count = 0;
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.email === "abdullah.amr.makky@gmail.com" || data.googleLinkedEmail === "abdullah.amr.makky@gmail.com") {
        console.log(`  Found document [${doc.id}]:`, data);
        count++;
      }
    });
    console.log(`  Total linked to abdullah.amr.makky@gmail.com in ${col}: ${count}`);
  }
}

main().catch(console.error);

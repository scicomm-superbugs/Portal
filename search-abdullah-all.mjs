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
    console.log(`\nChecking collection: ${col}`);
    const snap = await getDocs(collection(db, col));
    snap.docs.forEach(doc => {
      const data = doc.data();
      const email = (data.email || "").toLowerCase();
      const googleEmail = (data.googleLinkedEmail || "").toLowerCase();
      const name = (data.name || "").toLowerCase();
      const username = (data.username || "").toLowerCase();
      
      if (
        email.includes("makky") || 
        googleEmail.includes("makky") || 
        username.includes("makky") ||
        email.includes("maged") ||
        googleEmail.includes("maged") ||
        username.includes("maged") ||
        username.includes("abdullah")
      ) {
        console.log(`  Found document [${doc.id}]:`, data);
      }
    });
  }
}

main().catch(console.error);

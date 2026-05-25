import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

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
  const targetEmail = "abdullah.amr.makky@gmail.com";
  const collections = ["scientists", "alamein_scientists", "aiuscicomm_scientists"];
  
  for (const col of collections) {
    console.log(`\nScanning collection: ${col}`);
    const snap = await getDocs(collection(db, col));
    
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (
        data.email === targetEmail || 
        data.googleLinkedEmail === targetEmail
      ) {
        console.log(`Found matching document [${docSnap.id}] in ${col}:`);
        console.log(`  Current googleLinked: ${data.googleLinked}`);
        console.log(`  Current googleLinkedEmail: ${data.googleLinkedEmail}`);
        
        const docRef = doc(db, col, docSnap.id);
        await updateDoc(docRef, {
          googleLinked: false,
          googleLinkedEmail: null,
          googleDriveToken: null
        });
        
        console.log(`  Successfully updated document [${docSnap.id}] to unlink Google login.`);
      }
    }
  }
  console.log("\nUnlinking completed successfully!");
}

main().catch(console.error);

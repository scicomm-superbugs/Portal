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
  const collections = ["scientists", "alamein_scientists", "aiuscicomm_scientists"];
  for (const col of collections) {
    const docRef = doc(db, col, "master-bypass");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log(`\nDocument 'master-bypass' in ${col}:`);
      console.log(docSnap.data());
    } else {
      console.log(`\nDocument 'master-bypass' does not exist in ${col}`);
    }
  }
}

main().catch(console.error);

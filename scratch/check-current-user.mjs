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
  const docRef = doc(db, "aiuscicomm_scientists", "HDJpQVqaLQHUWic6yv3l");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    console.log("HDJpQVqaLQHUWic6yv3l details:");
    console.log(docSnap.data());
  } else {
    console.log("HDJpQVqaLQHUWic6yv3l does not exist!");
  }
}

main().catch(console.error);

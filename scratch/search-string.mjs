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

const baseCollections = [
  "chemicals", "scientists", "usage_logs", "devices", "equipment", "tasks", "messages",
  "scicomm_posts", "scicomm_warnings", "scicomm_connections", "scicomm_meetings",
  "scicomm_chat_rooms", "scicomm_chat_messages", "scicomm_stories", "scicomm_banners",
  "scicomm_recognitions", "scicomm_applications", "scicomm_notifications", "scicomm_app_downloads"
];

const workspaces = ["", "alamein_", "aiuscicomm_"];

async function main() {
  console.log("Searching database for 'Laboratory Master'...");
  for (const base of baseCollections) {
    for (const ws of workspaces) {
      const colName = `${ws}${base}`;
      try {
        const snap = await getDocs(collection(db, colName));
        snap.docs.forEach(docSnap => {
          const str = JSON.stringify(docSnap.data());
          if (str.toLowerCase().includes("laboratory master")) {
            console.log(`Found in collection '${colName}', Document ID '${docSnap.id}':`);
            console.log(docSnap.data());
          }
        });
      } catch (e) {
        // Skip collections that don't exist
      }
    }
  }
  console.log("Search completed!");
}

main().catch(console.error);

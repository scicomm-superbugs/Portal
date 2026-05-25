import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC1GvAMikaE9AbbHHJE_Ivqe49Se4FcX-o",
  authDomain: "chompchem.firebaseapp.com",
  projectId: "chompchem",
  storageBucket: "chompchem.firebasestorage.app",
  messagingSenderId: "374289425018",
  appId: "1:374289425018:web:eb26faff09050e80fbd498"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

async function deleteMasterBypass() {
  const collections = ['scientists', 'alamein_scientists', 'aiuscicomm_scientists'];
  
  for (const colName of collections) {
    console.log(`\n--- Checking ${colName} ---`);
    
    // Check for master-bypass document
    const masterRef = doc(firestore, colName, 'master-bypass');
    const masterSnap = await getDoc(masterRef);
    
    if (masterSnap.exists()) {
      console.log(`  Found master-bypass document:`, masterSnap.data());
      await deleteDoc(masterRef);
      console.log(`  ✅ DELETED master-bypass from ${colName}`);
    } else {
      console.log(`  No master-bypass document found.`);
    }
    
    // Also check for any document with username 'master' or name containing 'Laboratory Master'
    try {
      const colRef = collection(firestore, colName);
      const allDocs = await getDocs(colRef);
      for (const docSnap of allDocs.docs) {
        const data = docSnap.data();
        if (data.username === 'master' || (data.name && data.name.includes('Laboratory Master'))) {
          console.log(`  ⚠️ Found suspicious document ${docSnap.id}:`, {
            username: data.username,
            name: data.name,
            email: data.email,
            role: data.role
          });
        }
      }
    } catch (err) {
      console.log(`  Error scanning ${colName}:`, err.message);
    }
  }
  
  console.log('\n✅ Cleanup complete!');
  process.exit(0);
}

deleteMasterBypass().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc } = require('firebase/firestore');
const fs = require('fs');

const content = fs.readFileSync('src/firebase/firebase.js', 'utf8');
const cfgMatch = content.match(/const firebaseConfig = ({[\s\S]*?})/);
eval('var cfg = ' + cfgMatch[1]);

const app = initializeApp(cfg);
const db = getFirestore(app);

async function run() {
  try {
    console.log('Fetching priceLists...');
    const snap = await getDocs(collection(db, 'priceLists'));
    console.log('Total priceLists:', snap.docs.length);
    const all = [];

    for (const d of snap.docs) {
      if (d.id === 'categories_settings' || d.id === 'hero_slides_settings' || d.id === 'web_catalog_snapshot') continue;
      const pSnap = await getDocs(collection(db, 'priceLists', d.id, 'products'));
      for (const pDoc of pSnap.docs) {
        const p = pDoc.data();
        if (p.showOnWeb === true) {
          const rawImages = p.webImages || p.images || [];
          let firstImg = '';
          for (const img of rawImages) {
            if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('./') || img.startsWith('/'))) {
              firstImg = img;
              break;
            }
          }
          all.push({
            id: pDoc.id,
            name: p.name || '',
            code: p.code || '',
            powerKw: p.powerKw || '',
            powerHp: p.powerHp || '',
            head: p.head || '',
            flow: p.flow || '',
            price: p.price || 0,
            listId: d.id,
            listName: d.data().name || '',
            webBrand: p.webBrand || p.brand || '',
            group: p.group || '',
            category: p.category || '',
            featured: p.featured || false,
            showOnWeb: true,
            voltage: p.voltage || '',
            pipe: p.pipe || '',
            webImages: firstImg ? [firstImg] : [],
            hasFullImages: rawImages.length > 1
          });
        }
      }
    }

    console.log('Found total clean onWeb products:', all.length);
    const payload = JSON.stringify(all);
    console.log('Payload size in bytes:', Buffer.byteLength(payload), 'bytes (~' + Math.round(Buffer.byteLength(payload)/1024) + ' KB)');

    const snapRef = doc(db, 'priceLists', 'web_catalog_snapshot');
    await setDoc(snapRef, { products: all, updatedAt: Date.now() });
    console.log('✅ Successfully saved snapshot to Firestore!');

    const check = await getDoc(snapRef);
    console.log('✅ Verified products count in Firestore snapshot:', check.data()?.products?.length);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during sync:', err);
    process.exit(1);
  }
}

run();

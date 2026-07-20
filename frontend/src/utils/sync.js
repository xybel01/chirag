import { setCollectionDoc, getCollectionItems } from './firebase.js';

export async function syncAssetsToFirestore(assets) {
  if (!assets || !Array.isArray(assets)) return;
  try {
    const users = await getCollectionItems('users');
    for (const asset of assets) {
      await syncSingleAssetToFirestore(asset, users);
    }
  } catch (err) {
    console.error('Batch sync failed:', err);
  }
}

export async function syncSingleAssetToFirestore(asset, cachedUsers = null) {
  if (!asset) return;
  try {
    let assignedUserId = null;
    if (asset.assignedTo?.email) {
      const email = asset.assignedTo.email.toLowerCase();
      const users = cachedUsers || await getCollectionItems('users');
      const matchedUser = users.find(u => u.email?.toLowerCase() === email);
      if (matchedUser) {
        assignedUserId = matchedUser.id; // Store Firestore User Document ID
      } else {
        assignedUserId = email; // Fallback to email
      }
    }

    const firestoreAsset = {
      assetId: asset.assetTag,
      category: asset.category?.name || 'Unknown',
      manufacturer: asset.manufacturer,
      model: asset.model,
      serialNumber: asset.serialNumber,
      ram: asset.ram || null,
      storage: asset.storage || null,
      cpu: asset.cpu || null,
      status: asset.status,
      location: asset.location?.name || null,
      department: asset.department?.name || null,
      purchaseDate: asset.purchaseDate || null,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      warrantyExpiry: asset.warrantyEnd || null,
      assignedUserId: assignedUserId,
      assignedUserName: asset.assignedTo?.name || null,
    };
    const docId = asset.serialNumber || asset.assetTag;
    await setCollectionDoc('assets', docId, firestoreAsset);
  } catch (err) {
    console.error(`Error syncing asset ${asset.assetTag}:`, err);
  }
}

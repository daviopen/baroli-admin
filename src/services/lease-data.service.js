import { cachedRead } from '../core/read-cache.js';
import { getFirebaseServices } from './firebase.service.js';

const LEASE_OPTIONS_TTL_MS = 5 * 60_000;
const LEASE_OPTIONS_LIMIT = 300;
const PROPERTY_OPTIONS_LIMIT = 300;

function text(value) {
  return String(value ?? '').trim();
}

export async function loadLeaseTerminationOptions({ force = false } = {}) {
  const { db, firestoreSdk, auth } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error('Sessão expirada. Entre novamente.');
  const uid = auth.currentUser.uid;

  return cachedRead(`lease-termination:options:${uid}`, async () => {
    const { collection, getDocs, query, limit } = firestoreSdk;
    const leaseSnapshot = await getDocs(query(collection(db, 'leases'), limit(LEASE_OPTIONS_LIMIT)));
    let properties = new Map();
    try {
      const propertySnapshot = await getDocs(query(collection(db, 'properties'), limit(PROPERTY_OPTIONS_LIMIT)));
      properties = new Map(propertySnapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() }]));
    } catch (error) {
      console.warn('[Lease termination] Base de imóveis indisponível para este perfil; usando o retrato contratual importado.', error?.code || error);
    }

    const leases = leaseSnapshot.docs.map((item) => {
      const lease = { id: item.id, ...item.data() };
      const property = lease.propertyId ? properties.get(lease.propertyId) : null;
      return {
        ...lease,
        property: property || null,
        propertyLabel: property
          ? [property.reference, property.address].filter(Boolean).join(' · ')
          : text(lease.propertyRaw) || text(lease.propertyReference) || 'Imóvel não identificado'
      };
    });

    leases.sort((a, b) => {
      const aActive = a.closedAt ? 1 : 0;
      const bActive = b.closedAt ? 1 : 0;
      if (aActive !== bActive) return aActive - bActive;
      return text(b.startDate).localeCompare(text(a.startDate));
    });

    return leases;
  }, { ttlMs: LEASE_OPTIONS_TTL_MS, force });
}

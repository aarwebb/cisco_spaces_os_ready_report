// LocationProcessor class for reading locationMap items from IndexedDB
class LocationProcessor {
	/**
	 * Reads and parses the 'locationMap' object from IndexedDB 'dashboardDB', returning the item for the given tenantId and username.
	 * Flattens the nested data structure for easy use.
	 * @param {string} tenantId - The tenant ID to look up in locationMap.
	 * @param {string} username - The username to look up in locationMap.
	 * @returns {Promise<any>} - Resolves to the flattened locationMap item, or null if not found.
	 */
	static async getFlattenedLocationData(tenantId, username) {
		const key = `${tenantId}${username}`;
		console.log('[LocationProcessor] Looking up key:', key);
		return new Promise((resolve) => {
			const request = indexedDB.open('dashboardDB');
			request.onsuccess = function(event) {
				const db = event.target.result;
				console.log('[LocationProcessor] DB opened:', db);
				if (!db.objectStoreNames.contains('locationMap')) {
					console.warn('[LocationProcessor] locationMap object store not found');
					return resolve(null);
				}
				const objectStore = db.transaction(['locationMap'], 'readonly').objectStore('locationMap');
				const getRequest = objectStore.get(key);
				getRequest.onsuccess = function(event) {
					const entry = event.target.result;
					console.log('[LocationProcessor] Entry fetched:', entry);
					if (!entry || !entry.data) {
						console.warn('[LocationProcessor] No entry or missing .data for key:', key);
						return resolve(null);
					}
					let mapObj = entry.data;
					if (mapObj instanceof Map) mapObj = Object.fromEntries(mapObj);
					else if (typeof mapObj === 'object' && mapObj !== null && typeof mapObj.entries === 'function') {
						try { mapObj = Object.fromEntries(mapObj.entries()); } catch (e) {
							console.warn('[LocationProcessor] Error converting mapObj.entries:', e);
						}
					}
					console.log('[LocationProcessor] Returning mapObj:', mapObj);
					resolve(mapObj);
				};
				getRequest.onerror = function() {
					console.warn('[LocationProcessor] Error fetching key:', key);
					resolve(null);
				};
			};
			request.onerror = function() {
				console.warn('[LocationProcessor] Error opening dashboardDB');
				resolve(null);
			};
		});
	}
}

// Export for use in other scripts and manifest inclusion
globalThis.LocationProcessor = LocationProcessor;
console.log('[locationProcessor] LocationProcessor attached:', typeof globalThis.LocationProcessor);
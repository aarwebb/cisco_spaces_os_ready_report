// Location data checker for Spaces OS Ready Report v2

// Endpoint constants
const BUILDINGS_LIST = '/api/v1/maps/bl/list';
const CMX_LOCATIONS_COUNT = '/api/v1/location/cmx/locations/count';
const MERAKI_LOCATIONS_COUNT = '/api/v1/location/org/networks/count/api';



class LocationChecker {
  constructor(domain) {
    this.domain = domain;
  }

  async execute() {
    // Get tenantId and username using checkUtils
    const tenantInfo = await globalThis.getTenantInfo(this.domain);
    const username = await globalThis.getUsername(this.domain);
    const tenantId = tenantInfo?.tenantId || 'unknownTenant';
    const user = username || 'unknownUser';

    const endpoints = [
      BUILDINGS_LIST,
      CMX_LOCATIONS_COUNT,
      MERAKI_LOCATIONS_COUNT
    ];
    const client = globalThis.createApiClient(this.domain);
    console.log('[locationCheck] Creating API client for domain:', this.domain);
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })));
    console.log('[locationCheck] API call results:', results);

    // Get location data from IndexedDB using LocationProcessor
    let locationMapData = null;
    if (globalThis.LocationProcessor) {
      try {
        locationMapData = await globalThis.LocationProcessor.getFlattenedLocationData(tenantId, user);
      } catch (e) {
        locationMapData = null;
      }
    }

    // Combine endpoint results and location processor data into a single object under 'location'
    const combinedResults = {};
    if (Array.isArray(results)) {
      endpoints.forEach((endpoint, idx) => {
        combinedResults[endpoint] = results[idx];
      });
    } else if (typeof results === 'object' && results !== null) {
      Object.assign(combinedResults, results);
    }
  const locationKey = `locationProcessor_${tenantId}${user}`;
    combinedResults[locationKey] = locationMapData;

    return { location: combinedResults };
  }

  static reportModule = {
    generateHTML: function(data) {
      console.log('[locationCheck] Generating HTML for location data:', data);
      return `
        <div class="section" id="location-section">
          <h2 class="section-title">Location Data</h2>
          <pre style="white-space: pre-wrap; word-break: break-all; background: #f5f5f5; padding: 1em; border-radius: 4px;">
            ${JSON.stringify(data, null, 2)}
          </pre>
        </div>
      `;
    },
    processData: function(rawData) {
      console.log('[locationCheck] Processing raw location data:', rawData);
      return rawData || {};
    }
  };
}

globalThis.LocationChecker = LocationChecker;
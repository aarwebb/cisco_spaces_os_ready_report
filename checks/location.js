// Location data checker for Spaces OS Ready Report v2

// Endpoint constants
const BUILDINGS_LIST = '/api/v1/maps/bl/list';
const CMX_LOCATIONS_COUNT = '/api/v1/location/cmx/locations/count';
const MERAKI_LOCATIONS_COUNT = '/api/v1/location/org/networks/count/api';
const MAP_FLOORS_BASE = '/api/location/v2/map/floors?hierarchyMapSources=CMX,PRIME,DNAC,MERAKI,SPACES_2D_MAP';



class LocationChecker {
    static endpoints = [
      BUILDINGS_LIST,
      CMX_LOCATIONS_COUNT,
      MERAKI_LOCATIONS_COUNT,
      MAP_FLOORS_BASE
    ];
  constructor(domain) {
    this.domain = domain;
  }

  async execute({ onProgress } = {}) {
    // Get tenantId and username using checkUtils
    const tenantInfo = await globalThis.getTenantInfo(this.domain);
    const username = await globalThis.getUsername(this.domain);
    if (!username) {
      throw new Error('Unable to determine username: getUsername, userName, and supportUserName are all missing');
    }
    const tenantId = tenantInfo?.tenantId || 'unknownTenant';
    const user = username;

    // Prepare endpoints, replacing MAP_FLOORS_BASE with tenantId version if available
    let endpoints = [...LocationChecker.endpoints];
    if (tenantId && typeof tenantId === 'string' && tenantId !== 'unknownTenant') {
      endpoints = endpoints.map(endpoint =>
        endpoint === MAP_FLOORS_BASE
          ? `${MAP_FLOORS_BASE}&tenantId=${tenantId}`
          : endpoint
      );
    }
    console.log('[locationCheck] Creating API client for domain:', this.domain);
  const client = globalThis.createApiClient(this.domain);
  const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })), onProgress);
  
    console.log('[locationCheck] API call results:', results);

    // Get location data from IndexedDB using LocationProcessor
    let locationMapData = null;
    if (globalThis.LocationProcessor) {
      try {
        locationMapData = await globalThis.LocationProcessor.getFlattenedLocationData(tenantId, user);
        if (typeof onProgress === 'function') onProgress(1); // Count location processor as a progress unit
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
    console.log('[locationCheck] Combined location data:', combinedResults);
    const parsedData = LocationChecker.processData(combinedResults.locations || combinedResults );
    console.log('[locationCheck] Parsed location data:', parsedData);
    // Return raw and parsedData for downstream analysis/reporting (standard structure)
    return {
      location: {
        raw: combinedResults,
        parsedData
      }
    };
  }

  static getProgressUnitEstimate() {
    return LocationChecker.endpoints.length + 1; // Adding 1 for location processor
  }

  static processData(rawData) {
    // 1. Buildings List
    const buildingsList = rawData[BUILDINGS_LIST]?.data?.data || {};
    const buildings = buildingsList.buildings || [];
    const buildingSummary = {
      standardMapStatus: buildingsList.standardMapStatus,
      summary: buildingsList.summary,
      buildings,
      floors: buildingsList.floors,
      locations: buildingsList.locations,
      toBeReviewed: buildingsList.toBeReviewed,
      lh2Count: buildingsList.lh2Count,
      metadata: buildingsList.metadata,
      updated: buildingsList.updated,
      notUpdated: buildingsList.notUpdated,
      reviewSources: buildingsList.reviewSources,
      webexCount: buildingsList.webexCount,
      richMaps: buildingsList.richMaps,
      networkMaps: buildingsList.networkMaps,
      withMap: buildingsList.withMap,
      withErrors: buildingsList.withErrors,
      geoLocated: buildingsList.geoLocated,
      digitalMaps: buildingsList.digitalMaps,
      locationsArray: Array.isArray(buildingsList.locations) ? buildingsList.locations.map(l => ({ id: l.id, name: l.name })) : [],
      details: buildingsList.details,
      floorsWithMaps: buildingsList.floorsWithMaps,
      source: buildingsList.source,
      status: buildingsList.status,
      mapType: buildingsList.mapType,
      processingStatuses: buildingsList.processingStatuses
    };

    // 2. CMX Count
    const cmxCountRaw = rawData[CMX_LOCATIONS_COUNT]?.data?.data || {};
    const cmxCount = {
      importedCMXCount: cmxCountRaw.importedCMXCount,
      campus: cmxCountRaw.campus,
      building: cmxCountRaw.building,
      floor: cmxCountRaw.floor
    };

    // 3. Meraki Count
    const merakiCountRaw = rawData[MERAKI_LOCATIONS_COUNT]?.data?.data || {};
    const merakiCount = {
      totalOrgCount: merakiCountRaw.totalOrgCount,
      importedOrgCount: merakiCountRaw.importedOrgCount,
      totalNetworkCount: merakiCountRaw.totalNetworkCount,
      importedNetworkCount: merakiCountRaw.importedNetworkCount
    };

    // 4. Map Floors (dynamic endpoint)
    const mapFloorsEndpoint = Object.keys(rawData).find(key => key.startsWith(MAP_FLOORS_BASE));
    const mapFloorsRaw = mapFloorsEndpoint ? rawData[mapFloorsEndpoint] : [];
    const floors = Array.isArray(mapFloorsRaw)
      ? mapFloorsRaw.map(floor => ({
          locId: floor.locId,
          floorNumber: floor.details?.floorNumber,
          floorName: floor.locationHierarchy?.find(h => h.type === 'floor')?.name,
          shortName: floor.locationHierarchy?.find(h => h.type === 'floor')?.shortName,
          buildingName: floor.locationHierarchy?.find(h => h.type === 'building')?.name,
          campusName: floor.locationHierarchy?.find(h => h.type === 'campus')?.name,
          address: floor.address?.address,
          maps: floor.maps || [],
          calibrationModels: floor.calibModels || [],
          regions: floor.regions || [],
          hierarchyMapSources: floor.hierarchyMapSources || [],
          modifiedOn: floor.modifiedOn,
          zones: floor.zones || [],
          accessPoints: floor.accessPoints || []
        }))
      : [];

    // 5. LocationProcessor (IndexedDB)
    const locationProcessorKey = Object.keys(rawData).find(key => key.startsWith('locationProcessor_'));
    const locationProcessor = locationProcessorKey ? rawData[locationProcessorKey] : null;

    // Standard parsedData structure
    return {
      buildings: buildingSummary,
      cmxCount,
      merakiCount,
      floors,
      locationProcessor
    };
  }

  static reportModule = {
    generateHTML: function(processedData, analysisResults) {
      // Debug: log the size of processedData
      if (processedData && typeof processedData === 'object') {
        console.log('[LocationChecker] processedData key count:', Object.keys(processedData).length);
      } else {
        console.log('[LocationChecker] processedData is missing or not an object');
      }
      // Get alert icons
      const ALERT_ICONS = (typeof window !== 'undefined' && window.ALERT_ICONS) ? window.ALERT_ICONS : (typeof globalThis !== 'undefined' ? globalThis.ALERT_ICONS : {});
      // Helper to get row class based on alert type
      function getRowClass(alertType) {
        if (alertType === 'warning') return 'row-warning';
        if (alertType === 'info') return 'row-info';
        if (alertType === 'error') return 'row-error';
        if (alertType === 'good') return 'row-good';
        return '';
      }
      // Dynamically aggregate all alert types for summary
      const alertsObj = analysisResults.alerts || {};
      const alertTypeCounts = Object.values(alertsObj)
        .filter(Boolean)
        .reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
      const uniqueAlertTypes = Object.keys(alertTypeCounts);
      const alertIconsSummary = uniqueAlertTypes.map(type => {
        const iconUrl = ALERT_ICONS[type] || '';
        const count = alertTypeCounts[type];
        return iconUrl
          ? `<span class="alert-summary-icon"><img src="${iconUrl}" alt="${type}" title="${type}" /><span class="alert-summary-count">${count}</span></span>`
          : '';
      }).join('');

      // Aggregate all recommendations into summary
      const recommendationsObj = analysisResults.recommendations || {};
      const recommendationList = Object.values(recommendationsObj).filter(Boolean);
      const summaryRecommendations = recommendationList.length > 0
        ? `<ul class="recommendations-list">${recommendationList.map(rec => `<li>${rec}</li>`).join('')}</ul>`
        : 'No Recommendations';

      // Recommendations table (top)
      const recommendationsTable = `
        <table class="summary-table" style="margin-bottom:16px;">
          <tr>
            <th>Recommendation(s)</th>
          </tr>
          <tr>
            <td>${summaryRecommendations}</td>
          </tr>
        </table>`;

      // Calculate summary counts
      // Use robust logic for hierarchical locationProcessor data
      const locs = processedData.locationProcessor && typeof processedData.locationProcessor === 'object'
        ? Object.values(processedData.locationProcessor)
        : [];
      const buildingsCount = locs.filter(loc => (loc.type || []).includes('BUILDING') || (loc.inferredLocationTypes || []).includes('BUILDING')).length;
      const floorsCount = locs.filter(loc => (loc.type || []).includes('FLOOR') || (loc.inferredLocationTypes || []).includes('FLOOR')).length;
      const locationsCount = locs.length;
      const fallbackLocationsCount = buildingsCount;
      const mapsCount = locs.reduce((acc, loc) => acc + (Array.isArray(loc.maps) ? loc.maps.length : 0), 0);
      let allSources = new Set();
      locs.forEach(loc => {
        if (Array.isArray(loc.hierarchyMapSources)) {
          loc.hierarchyMapSources.forEach(src => allSources.add(src));
        }
      });
      const sourcesList = Array.from(allSources);
      const sourcesCount = sourcesList.length;

      // Build HTML table with per-row alert coloring
      return `
        <div class="section" id="location-section">
          <h2 class="section-title">Location
            <span class="alert-summary">${alertIconsSummary}</span>
          </h2>
          ${recommendationsTable}
          <table class="report-table" style="width:100%; margin-bottom:16px;">
            <tr><th colspan="2">Location Summary</th></tr>
            <tr><td>Total Buildings</td><td>${buildingsCount}</td></tr>
            <tr><td>Total Floors</td><td>${floorsCount}</td></tr>
            <tr><td>Total Locations</td><td>${locationsCount || fallbackLocationsCount}</td></tr>
            <tr><td>Total Maps</td><td>${mapsCount}</td></tr>
            <tr class="${getRowClass(analysisResults.alerts?.sources)}"><td>Map Sources</td><td>${sourcesCount}</td></tr>
            <tr class="${getRowClass(analysisResults.alerts?.gps)}"><td>Locations w/o GPS Markers</td><td>${analysisResults.recommendations?.gps ? analysisResults.recommendations.gps.replace(/\D/g, '') : ''}</td></tr>
            <tr class="${getRowClass(analysisResults.alerts?.buildings)}"><td>Buildings w/o Floors</td><td>${analysisResults.recommendations?.buildings ? analysisResults.recommendations.buildings.replace(/\D/g, '') : ''}</td></tr>
            <tr class="${getRowClass(analysisResults.alerts?.maps)}"><td>Maps w/ ERROR or IN_REVIEW</td><td>${analysisResults.recommendations?.maps ? analysisResults.recommendations.maps.replace(/\D/g, '') : ''}</td></tr>
            <tr class="${getRowClass(analysisResults.alerts?.sources)}"><td>Unknown Sources</td><td>${analysisResults.recommendations?.sources ? 'Yes' : 'No'}</td></tr>
          </table>
        </div>
      `;
    }
  };
}

// Attach the checker class to globalThis for use in orchestrator
globalThis.LocationChecker = LocationChecker;
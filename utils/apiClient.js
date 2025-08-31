// Shared API utility for Spaces OS Ready Report v2
// Handles cookie-based authentication, error handling, and logging

class SpacesApiClient {
  constructor(domain) {
    this.domain = domain;
    this.baseHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; Spaces-OS-Ready-Report/2.0)',
      'X-Requested-With': 'XMLHttpRequest'
    };
  }

  /**
   * Make an API call with automatic cookie authentication
   * @param {string} endpoint - API endpoint (e.g., '/api/v1/user/profile')
   * @param {Object} options - Request options
   * @param {string} options.method - HTTP method (default: 'GET')
   * @param {Object} options.body - Request body for POST/PUT requests
   * @param {Object} options.headers - Additional headers
   * @param {Object} options.params - Query parameters
   * @param {boolean} options.retry - Whether to retry on failure (default: true)
   * @param {number} options.timeout - Request timeout in ms (default: 30000)
   * @returns {Promise<Object>} API response data
   */
  async call(endpoint, options = {}, onProgress) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      params = {},
      retry = true,
      timeout = 30000
    } = options;

    // Build URL with parameters
    const url = this.buildUrl(endpoint, params);

    // Prepare request configuration
    const sysToken = window.currentSysToken || '';
    const requestConfig = {
      method,
      headers: {
        ...this.baseHeaders,
        ...(sysToken ? {'Cookie': `sys-token=${sysToken}`} : {}),
        ...headers
      },
      credentials: 'include',
      mode: 'cors'
    };

    // Add body for POST/PUT/PATCH requests
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      requestConfig.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    console.log(`🌐 API Call: ${method} ${url}`);

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      requestConfig.signal = controller.signal;

      const response = await fetch(url, requestConfig);
      clearTimeout(timeoutId);

      console.log(`📡 Response: ${response.status} ${response.statusText} for ${endpoint}`);

      if (!response.ok) {
        throw new ApiError(`HTTP ${response.status}: ${response.statusText}`, response.status, endpoint);
      }

      const data = await response.json();
      console.log(`✅ Success: ${endpoint} - Response keys:`, Object.keys(data));
      if (typeof onProgress === 'function') onProgress(1);
      return data;
    } catch (error) {
      console.warn(`❌ API Error: ${endpoint} - ${error.message}`);

      // Retry logic for network errors (not for 4xx/5xx errors)
      if (retry && this.shouldRetry(error)) {
        console.log(`🔄 Retrying: ${endpoint}`);
        await this.delay(1000); // Wait 1 second before retry
        return this.call(endpoint, { ...options, retry: false }); // Prevent infinite retry
      }

      throw error;
    }
  }

  /**
   * Make multiple API calls in parallel
   * @param {Array<Object>} requests - Array of request objects {endpoint, options}
   * @returns {Promise<Object>} Object with endpoint as key and result as value
   */
  async callMultiple(requests, onProgress) {
    console.log(`🚀 Making ${requests.length} sequential API calls with delay`);

    const results = [];
    for (let i = 0; i < requests.length; i++) {
      const { endpoint, options = {} } = requests[i];
      try {
        const data = await this.call(endpoint, options, onProgress);
        results.push({
          endpoint,
          success: true,
          data,
          timestamp: Date.now()
        });
      } catch (error) {
        results.push({
          endpoint,
          success: false,
          error: error.message,
          statusCode: error.statusCode,
          timestamp: Date.now()
        });
      }
      // Wait between calls except after the last one
      if (i < requests.length - 1) {
        const delayMs = typeof globalThis.API_CALL_DELAY === 'number' ? globalThis.API_CALL_DELAY : 2000;
        await this.delay(delayMs);
      }
    }

    // Convert array to object with endpoint as key
    const resultObject = {};
    results.forEach(result => {
      resultObject[result.endpoint] = result;
    });

    const successful = results.filter(r => r.success).length;
    console.log(`📊 API Results: ${successful}/${results.length} successful`);

    return resultObject;
  }

  /**
   * Try multiple endpoints until one succeeds
   * @param {Array<string>} endpoints - Array of endpoints to try
   * @param {Object} options - Request options
   * @returns {Promise<Object>} First successful response
   */
  async callFirstSuccess(endpoints, options = {}) {
    console.log(`🎯 Trying endpoints in order:`, endpoints);

    for (const endpoint of endpoints) {
      try {
        const data = await this.call(endpoint, { ...options, retry: false });
        console.log(`🎉 First success: ${endpoint}`);
        return { endpoint, data };
      } catch (error) {
        console.log(`⏭️ Failed ${endpoint}, trying next...`);
      }
    }

    throw new Error(`All endpoints failed: ${endpoints.join(', ')}`);
  }

  /**
   * Fetch all paginated results from an endpoint.
   * Handles ?page=X&pageSize=Y and combines all items.
   * Supports multiple pagination formats.
   * @param {string} endpoint - API endpoint path
   * @param {Object} params - Query parameters
   * @param {number} maxPageSize - Maximum allowed page size (default: 50)
   * @param {Object} [options={}] - Optional: { totalKey: 'totalBeacons', itemsKey: 'items' }
   * @returns {Promise<Array>} Combined results from all pages
   */
  async callPaginated(endpoint, params = {}, maxPageSize = 50, options = {}, onProgress) {
    let allResults = [];
    let page = 1;
    let totalPages = 1;
    let totalCount = null;
    const itemsKey = options.itemsKey || 'items';
    const totalKey = options.totalKey;
    let success = true;
    let error = null;
    let statusCode = null;
    try {
      do {
        const query = { ...params, page, pageSize: maxPageSize };
        const response = await this.call(endpoint, { params: query }, onProgress);
        // Extract items (allow custom key)
        const items = response[itemsKey] || response.data || [];
        allResults.push(...items);
        // Flexible pagination info
        const pagination = response.pagination || {};
        totalPages = pagination.totalPages || response.totalPages || 1;
        if (totalKey && response[totalKey]) {
          totalCount = response[totalKey];
          totalPages = Math.ceil(totalCount / maxPageSize);
        }
        page++;
      } while (page <= totalPages);
    } catch (err) {
      success = false;
      error = err.message;
      statusCode = err.statusCode;
    }
    return {
      endpoint,
      success,
      data: allResults,
      error,
      statusCode,
      timestamp: Date.now()
    };
  }

  buildUrl(endpoint, params = {}) {
    let url = `https://${this.domain}${endpoint}`;

    const paramKeys = Object.keys(params);
    if (paramKeys.length > 0) {
      const searchParams = new URLSearchParams();
      paramKeys.forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          searchParams.append(key, params[key]);
        }
      });
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  shouldRetry(error) {
    // Retry on network errors, timeouts, and 5xx server errors
    // Don't retry on 4xx client errors (auth, not found, etc.)
    return (
      error.name === 'AbortError' || // Timeout
      error.name === 'TypeError' || // Network error
      (error.statusCode && error.statusCode >= 500) // Server error
    );
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Custom error class for API errors
class ApiError extends Error {
  constructor(message, statusCode, endpoint) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

// Attach to globalThis for use in content scripts
globalThis.SpacesApiClient = SpacesApiClient;
globalThis.ApiError = ApiError;
globalThis.createApiClient = function(domain) {
  return new SpacesApiClient(domain);
};
globalThis.makeApiCall = async function(domain, endpoint, options = {}) {
  const client = globalThis.createApiClient(domain);
  return client.call(endpoint, options);
};
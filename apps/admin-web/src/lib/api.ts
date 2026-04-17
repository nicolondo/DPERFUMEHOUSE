import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('admin_refresh_token');
        if (!refreshToken) {
          redirectToLogin();
          return Promise.reject(error);
        }

        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken }
        );

        const tokens = data.data ?? data;
        if (tokens.accessToken) {
          localStorage.setItem('admin_access_token', tokens.accessToken);
          localStorage.setItem('admin_refresh_token', tokens.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        redirectToLogin();
      }
    }

    return Promise.reject(error);
  }
);

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
  }
}

/**
 * Unwrap API response - handles both wrapped { success, data } and direct responses.
 * For paginated endpoints that return { data: [], meta: {} }, returns the full object.
 */
function unwrap(axiosData: any): any {
  // If wrapped in { success, data }, unwrap
  if (axiosData && typeof axiosData === 'object' && 'success' in axiosData && 'data' in axiosData) {
    return axiosData.data;
  }
  return axiosData;
}

export default api;

// ----- API functions -----

export async function fetchDashboardStats() {
  const { data } = await api.get('/dashboard/admin');
  return unwrap(data);
}

export async function fetchUsers(params?: {
  page?: number;
  pageSize?: number;
  role?: string;
  status?: string;
  search?: string;
}) {
  const queryParams: Record<string, any> = { ...params };
  // Map frontend status filter to backend isActive param
  if (queryParams.status === 'active') {
    queryParams.isActive = 'true';
    delete queryParams.status;
  } else if (queryParams.status === 'inactive') {
    queryParams.isActive = 'false';
    delete queryParams.status;
  } else if (queryParams.status === 'pending') {
    queryParams.isActive = 'false';
    queryParams.pendingApproval = 'true';
    delete queryParams.status;
  } else {
    delete queryParams.status;
  }
  const { data } = await api.get('/users', { params: queryParams });
  return unwrap(data);
}

export async function fetchUser(id: string) {
  const { data } = await api.get(`/users/${id}`);
  return unwrap(data);
}

export async function createUser(payload: any) {
  const { data } = await api.post('/users', payload);
  return unwrap(data);
}

export async function updateUser(id: string, payload: any) {
  const { data } = await api.put(`/users/${id}`, payload);
  return unwrap(data);
}

export async function toggleUserStatus(id: string) {
  const { data } = await api.patch(`/users/${id}/toggle-status`);
  return unwrap(data);
}

export async function deleteUser(id: string) {
  await api.delete(`/users/${id}`);
}

export async function fetchProducts(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  onlyActive?: string;
  status?: string;
}) {
  const { data } = await api.get('/products', { params });
  return unwrap(data);
}

export async function fetchProductCategories() {
  const { data } = await api.get('/products/categories');
  return unwrap(data) as string[];
}

export async function toggleProductBlocked(id: string) {
  const { data } = await api.patch(`/products/${id}/block`);
  return unwrap(data);
}

export async function bulkDeactivateProducts(ids: string[]) {
  const { data } = await api.post('/products/bulk-deactivate', { ids });
  return unwrap(data);
}

export async function bulkActivateProducts(ids: string[]) {
  const { data } = await api.post('/products/bulk-activate', { ids });
  return unwrap(data);
}

export async function triggerSync() {
  const { data } = await api.post('/products/sync');
  return unwrap(data);
}

export async function refreshStock() {
  const { data } = await api.post('/products/refresh-stock');
  return unwrap(data);
}

export async function fetchSyncLogs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get('/products/sync-logs', { params });
  return unwrap(data);
}

export async function fetchStockRequests(params?: { page?: number; pageSize?: number; status?: string }) {
  const { data } = await api.get('/product-requests', { params });
  return unwrap(data);
}

export async function updateStockRequestStatus(id: string, status: string) {
  const { data } = await api.patch(`/product-requests/${id}/status`, { status });
  return unwrap(data);
}

export async function fetchOrders(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  paymentStatus?: string;
  sellerId?: string;
  from?: string;
  to?: string;
}) {
  const { data } = await api.get('/orders', { params });
  return unwrap(data);
}

export async function fetchCommissions(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  sellerId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { data } = await api.get('/commissions', { params });
  return unwrap(data);
}

export async function approveCommission(id: string) {
  const { data } = await api.patch(`/commissions/${id}/approve`);
  return unwrap(data);
}

export async function bulkApproveCommissions(ids: string[]) {
  const { data } = await api.post('/commissions/bulk-approve', { commissionIds: ids });
  return unwrap(data);
}

export async function fetchPayouts(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const { data } = await api.get('/payouts', { params });
  return unwrap(data);
}

export async function createPayout(payload: { userId: string; amount: number; method: string }) {
  const { data } = await api.post('/payouts', payload);
  return unwrap(data);
}

export async function processPayout(id: string) {
  const { data } = await api.patch(`/payouts/${id}/process`);
  return unwrap(data);
}

export async function fetchSettings(group?: string, includeSecrets?: boolean) {
  const { data } = await api.get('/settings', { params: { group, includeSecrets } });
  // Settings endpoint returns array directly
  return Array.isArray(data) ? data : unwrap(data);
}

export async function updateSettings(settings: { key: string; value: string }[]) {
  const { data } = await api.put('/settings', { settings });
  return unwrap(data);
}

export async function testOdooConnection() {
  const { data } = await api.post('/settings/test-odoo');
  return unwrap(data);
}

export async function fetchOdooCompanies() {
  const { data } = await api.get('/settings/odoo-companies');
  const result = unwrap(data);
  return result?.data ?? result ?? [];
}

export async function fetchOdooPricelists() {
  const { data } = await api.get('/settings/odoo-pricelists');
  const result = unwrap(data);
  return result?.data ?? result ?? [];
}

export async function fetchOdooCategories() {
  const { data } = await api.get('/settings/odoo-categories');
  const result = unwrap(data);
  return result?.data ?? result ?? [];
}

export async function fetchOdooLocations() {
  const { data } = await api.get('/settings/odoo-locations');
  const result = unwrap(data);
  return result?.data ?? result ?? [];
}

export async function testPaymentConnection() {
  const { data } = await api.post('/settings/test-payment');
  return unwrap(data);
}

export async function testWompiConnection() {
  const { data } = await api.post('/settings/test-wompi');
  return unwrap(data);
}

export async function fetchPaymentLogs(params?: { page?: number; pageSize?: number }) {
  const { data } = await api.get('/settings/payment-logs', { params });
  return unwrap(data);
}

export async function fetchOrder(id: string) {
  const { data } = await api.get(`/orders/${id}`);
  return unwrap(data);
}

export async function reverseCommission(id: string) {
  const { data } = await api.patch(`/commissions/${id}/reverse`);
  return unwrap(data);
}

export async function completePayout(id: string, reference?: string) {
  const { data } = await api.patch(`/payouts/${id}/complete`, { reference });
  return unwrap(data);
}

export async function syncPayoutOdoo(id: string) {
  const { data } = await api.patch(`/payouts/${id}/sync-odoo`);
  return unwrap(data);
}

export async function fetchCustomers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  sellerId?: string;
}) {
  const { data } = await api.get('/customers', { params });
  return unwrap(data);
}

export async function fetchCustomer(id: string) {
  const { data } = await api.get(`/customers/${id}`);
  return unwrap(data);
}

export async function updateCustomer(id: string, payload: any) {
  const { data } = await api.put(`/customers/${id}`, payload);
  return unwrap(data);
}

export async function fetchSellers() {
  const { data } = await api.get('/users/sellers');
  return unwrap(data);
}

export async function fetchCommissionSummary(userId?: string) {
  const params = userId ? { userId } : {};
  const { data } = await api.get('/commissions/summary', { params });
  return unwrap(data);
}

export async function fetchProduct(id: string) {
  const { data } = await api.get(`/products/${id}`);
  return unwrap(data);
}

export async function fetchProductImages(variantId: string) {
  const { data } = await api.get(`/products/${variantId}/images`);
  return unwrap(data);
}

export async function uploadProductImage(variantId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('variantId', variantId);
  const { data } = await api.post('/images/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap(data);
}

export async function deleteProductImage(imageId: string) {
  const { data } = await api.delete(`/images/${imageId}`);
  return unwrap(data);
}

export async function setProductImagePrimary(imageId: string) {
  const { data } = await api.patch(`/images/${imageId}/primary`);
  return unwrap(data);
}

export async function fetchMonthlyBonuses(params?: {
  year?: number;
  month?: number;
  sellerId?: string;
}) {
  const { data } = await api.get('/commissions/monthly-bonus', { params });
  return unwrap(data);
}

export async function runMonthlyBonusProcess(year: number, month: number) {
  const { data } = await api.post('/commissions/monthly-bonus/run', { year, month });
  return unwrap(data);
}

export async function retryMonthlyBonus(id: string) {
  const { data } = await api.patch(`/commissions/monthly-bonus/${id}/retry`);
  return unwrap(data);
}

// ── Fragrance Profiles ──

export async function fetchFragranceProfiles(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const { data } = await api.get('/fragrance-profiles', { params });
  return unwrap(data);
}

export async function fetchFragranceProfile(id: string) {
  const { data } = await api.get(`/fragrance-profiles/${id}`);
  return unwrap(data);
}

export async function fetchVariantsWithProfileStatus(params?: { search?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get('/fragrance-profiles/variants', { params });
  return unwrap(data);
}

export async function createFragranceProfile(dto: any) {
  const { data } = await api.post('/fragrance-profiles', dto);
  return unwrap(data);
}

export async function updateFragranceProfile(id: string, dto: any) {
  const { data } = await api.put(`/fragrance-profiles/${id}`, dto);
  return unwrap(data);
}

export async function bulkImportFragranceProfiles(profiles: any[]) {
  const { data } = await api.post('/fragrance-profiles/bulk-import', { profiles });
  return unwrap(data);
}

export async function enrichFragranceProfile(id: string) {
  const { data } = await api.post(`/fragrance-profiles/${id}/enrich`);
  return unwrap(data);
}

// ── Leads (Admin) ──

export async function fetchAdminLeads(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}) {
  const { data } = await api.get('/leads/admin/all', { params });
  return unwrap(data);
}

export async function fetchAdminLeadAnalytics() {
  const { data } = await api.get('/leads/admin/analytics');
  return unwrap(data);
}

export async function fetchAdminLeadById(id: string) {
  const { data } = await api.get(`/leads/admin/${id}`);
  return unwrap(data);
}

// ── Questionnaire Questions ──

export async function fetchQuestionnaireQuestions() {
  const { data } = await api.get('/questionnaire-questions');
  return unwrap(data);
}

export async function createQuestionnaireQuestion(dto: any) {
  const { data } = await api.post('/questionnaire-questions', dto);
  return unwrap(data);
}

export async function updateQuestionnaireQuestion(id: string, dto: any) {
  const { data } = await api.put(`/questionnaire-questions/${id}`, dto);
  return unwrap(data);
}

export async function deleteQuestionnaireQuestion(id: string) {
  const { data } = await api.delete(`/questionnaire-questions/${id}`);
  return unwrap(data);
}

export async function reorderQuestionnaireQuestions(ids: string[]) {
  const { data } = await api.post('/questionnaire-questions/reorder', { ids });
  return unwrap(data);
}

// ── Quantity Discounts ──

export async function fetchDiscounts() {
  const { data } = await api.get('/discounts');
  return unwrap(data);
}

export async function createDiscount(dto: any) {
  const { data } = await api.post('/discounts', dto);
  return unwrap(data);
}

export async function updateDiscount(id: string, dto: any) {
  const { data } = await api.put(`/discounts/${id}`, dto);
  return unwrap(data);
}

export async function deleteDiscount(id: string) {
  await api.delete(`/discounts/${id}`);
}

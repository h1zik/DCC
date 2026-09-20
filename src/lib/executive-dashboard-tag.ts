/**
 * Tag cache Executive overview. File terpisah agar server action (mis. mutasi
 * stok) bisa meng-invalidate tanpa mengimpor seluruh loader dashboard.
 */
export const EXEC_DASHBOARD_TAG = "exec-dashboard";

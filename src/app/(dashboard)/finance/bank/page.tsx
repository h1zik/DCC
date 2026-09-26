import { redirect } from "next/navigation";

// Rekening kini dikelola dari Chart of Accounts (akun Aktiva + "Akun kas / arus
// kas"). Rute lama dipertahankan agar bookmark tidak 404.
export default function BankPage() {
  redirect("/finance/chart-of-accounts");
}

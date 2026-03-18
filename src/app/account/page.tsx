import { CustomerAccountDashboard } from "@/components/account/customer-account-dashboard";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">My Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Saved drafts and purchase history</h1>
      </div>
      <CustomerAccountDashboard />
    </div>
  );
}




import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import PinForm from "@/components/PinForm";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-court-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-court-700 text-white text-2xl font-display font-bold mb-4">
            🏸
          </div>
          <h1 className="text-2xl font-display font-bold text-court-900">Bracket Badminton</h1>
          <p className="text-sm text-ink-500 mt-1">Masukkan PIN aplikasi untuk melanjutkan</p>
        </div>
        <div className="bg-white shadow-lg shadow-court-900/5 rounded-2xl p-8 border border-court-100">
          <PinForm />
        </div>
      </div>
    </main>
  );
}

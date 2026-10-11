
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F8FBFF]">
      <AdminSidebar />

      <div className="lg:pl-72">
        <AdminHeader />

        <main className="min-h-[calc(100vh-73px)] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
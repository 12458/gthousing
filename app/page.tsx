import Footer from "@/components/footer.jsx";
import Dashboard from "../components/dashboard.jsx";
import { Suspense } from "react";

export default function Home() {
  return (
    <div>
      <Suspense>
        <Dashboard />
      </Suspense>
      <Footer />
    </div>
  );
}

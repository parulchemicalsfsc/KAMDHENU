import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import FieldOfficerForm from "./pages/FieldOfficerForm";
import DemoSalesList from "./pages/DemoSalesList";
import DeleteRecords from "./pages/DeleteRecords";
import HistoryPage from "./pages/HistoryPage";
import RoutePlanner from "./pages/RoutePlanner";
import Login from "./pages/Login.jsx";
import MoMForm from "./pages/MoMForm.jsx";
import ViewRoute from "./pages/ViewRoute.jsx";
import RequireAuth from "./components/RequireAuth";
import MemberPage from "./pages/MemberPage";
import RequireRole from "./components/RequireRole";
import AdminPanel from "./pages/AdminPanel";
import StockDashboard from "./pages/StockDashboard";
import "./style/form.css";

import OfflineBanner from "./components/OfflineBanner";
// ✅ import ToastContainer once at the top level
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Open routes accessible to all authenticated users */}
        <Route
          path="/member-page"
          element={
            <RequireAuth>
              <MemberPage />
            </RequireAuth>
          }
        />

        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />

        <Route
          path="/route-planner"
          element={
            <RequireAuth>
              <RoutePlanner />
            </RequireAuth>
          }
        />

        <Route
          path="/view-route"
          element={
            <RequireAuth>
              <ViewRoute />
            </RequireAuth>
          }
        />

        <Route
          path="/stock-dashboard"
          element={
            <RequireAuth>
              <StockDashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/demo-sales-list"
          element={
            <RequireRole
              allowedRoles={["admin", "manager", "user", "field_officer"]}
            >
              <DemoSalesList />
            </RequireRole>
          }
        />

        <Route
          path="/mom-generator"
          element={
            <RequireAuth>
              <MoMForm />
            </RequireAuth>
          }
        />

        {/* Role-guarded routes */}
        <Route
          path="/form"
          element={
            <RequireRole allowedRoles={["admin", "manager", "field_officer"]}>
              <FieldOfficerForm />
            </RequireRole>
          }
        />

        <Route
          path="/history"
          element={
            <RequireRole checkHistoryAccess={true}>
              <HistoryPage />
            </RequireRole>
          }
        />

        <Route
          path="/delete"
          element={
            <RequireRole allowedRoles={["admin"]}>
              <DeleteRecords />
            </RequireRole>
          }
        />

        <Route
          path="/admin-panel"
          element={
            <RequireRole allowedRoles={["admin"]}>
              <AdminPanel />
            </RequireRole>
          }
        />

        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>

      <OfflineBanner />
      {/* ✅ Toast container at the root so it works everywhere */}
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

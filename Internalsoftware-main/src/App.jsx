import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import "./style/form.css";

import OfflineBanner from "./components/OfflineBanner";
// ✅ import ToastContainer once at the top level
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Lazy-load page components
const Home = lazy(() => import("./pages/Home"));
const FieldOfficerForm = lazy(() => import("./pages/FieldOfficerForm"));
const DemoSalesList = lazy(() => import("./pages/DemoSalesList"));
const DeleteRecords = lazy(() => import("./pages/DeleteRecords"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const RoutePlanner = lazy(() => import("./pages/RoutePlanner"));
const Login = lazy(() => import("./pages/Login.jsx"));
const MoMForm = lazy(() => import("./pages/MoMForm.jsx"));
const ViewRoute = lazy(() => import("./pages/ViewRoute.jsx"));
const MemberPage = lazy(() => import("./pages/MemberPage"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const StockDashboard = lazy(() => import("./pages/StockDashboard"));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh]">
    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-slate-500 font-bold">Loading page...</p>
  </div>
);

export default function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>

      <OfflineBanner />
      {/* ✅ Toast container at the root so it works everywhere */}
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

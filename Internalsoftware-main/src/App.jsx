import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import FieldOfficerForm from './FieldOfficerForm';
import DemoSalesList from './DemoSalesList';
import DemoSalesHistory from './DemoSalesHistory';
import DeleteRecords from './DeleteRecords';
import HistoryPage from './components/History/HistoryPage';
import RoutePlanner from './RoutePlanner';
import Login from "./login.jsx";
import MoMForm from './MoMForm.jsx';
import ViewRoute from './ViewRoute.jsx';
import RequireAuth from './RequireAuth';
import MemberPage from './MemberPage';
import RequireRole from './components/RequireRole';
import AdminPanel from './pages/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';
import './form.css';

// ✅ import ToastContainer once at the top level
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />

        {/* Open routes accessible to all authenticated users */}
        <Route path="/member-page" element={
          <ErrorBoundary>
            <RequireAuth>
              <MemberPage />
            </RequireAuth>
          </ErrorBoundary>
        } />

        <Route path="/" element={
          <ErrorBoundary>
            <RequireAuth>
              <Home />
            </RequireAuth>
          </ErrorBoundary>
        } />

        <Route path="/route-planner" element={
          <ErrorBoundary>
            <RequireAuth>
              <RoutePlanner />
            </RequireAuth>
          </ErrorBoundary>
        } />

        <Route path="/view-route" element={
          <ErrorBoundary>
            <RequireAuth>
              <ViewRoute />
            </RequireAuth>
          </ErrorBoundary>
        } />

        <Route path="/demo-sales-list" element={
          <ErrorBoundary>
            <RequireRole allowedRoles={['admin', 'manager', 'user', 'field_officer']}>
              <DemoSalesList />
            </RequireRole>
          </ErrorBoundary>
        } />

        <Route path="/demo-history" element={
          <ErrorBoundary>
            <RequireAuth>
              <DemoSalesHistory />
            </RequireAuth>
          </ErrorBoundary>
        } />

        <Route path="/mom-generator" element={
          <ErrorBoundary>
            <RequireAuth>
              <MoMForm />
            </RequireAuth>
          </ErrorBoundary>
        } />

        {/* Role-guarded routes */}
        <Route path="/form" element={
          <ErrorBoundary>
            <RequireRole allowedRoles={['admin', 'manager', 'field_officer']}>
              <FieldOfficerForm />
            </RequireRole>
          </ErrorBoundary>
        } />

        <Route path="/history" element={
          <ErrorBoundary>
            <RequireRole checkHistoryAccess={true}>
              <HistoryPage />
            </RequireRole>
          </ErrorBoundary>
        } />

        <Route path="/delete" element={
          <ErrorBoundary>
            <RequireRole allowedRoles={['admin']}>
              <DeleteRecords />
            </RequireRole>
          </ErrorBoundary>
        } />

        <Route path="/admin-panel" element={
          <ErrorBoundary>
            <RequireRole allowedRoles={['admin']}>
              <AdminPanel />
            </RequireRole>
          </ErrorBoundary>
        } />

        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>

      {/* ✅ Toast container at the root so it works everywhere */}
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}


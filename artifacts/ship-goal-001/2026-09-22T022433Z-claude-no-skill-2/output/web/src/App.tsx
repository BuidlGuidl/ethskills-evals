import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Spinner } from './components/Bits.js';
import { useSession } from './lib/session.js';
import { SignIn } from './pages/SignIn.js';
import { Browse } from './pages/Browse.js';
import { ToolDetail } from './pages/ToolDetail.js';
import { NewTool } from './pages/NewTool.js';
import { Loans } from './pages/Loans.js';
import { Wallet } from './pages/Wallet.js';
import { Members } from './pages/Members.js';
import { MemberProfile } from './pages/MemberProfile.js';

export function App() {
  const { member, loading } = useSession();

  if (loading) {
    return (
      <div className="shell">
        <div className="content">
          <Spinner label="Opening the shed…" />
        </div>
      </div>
    );
  }

  // Everything except the sign-in screen needs a member: this is a members-only
  // library, and the API enforces the same rule.
  if (!member) {
    return (
      <Routes>
        <Route path="/login" element={<SignIn />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Browse />} />
        <Route path="/tools/new" element={<NewTool />} />
        <Route path="/tools/:id" element={<ToolDetail />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/members" element={<Members />} />
        <Route path="/members/:id" element={<MemberProfile />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
